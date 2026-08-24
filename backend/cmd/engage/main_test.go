package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestHandlerServesKioskAndHealth(t *testing.T) {
	t.Setenv("CTG_ENGAGE_PACKAGE", "")
	webRoot := t.TempDir()
	writeTestFile(t, webRoot, "index.html", "<title>CTG Engage</title>")
	writeTestFile(t, webRoot, "experience.json", `{"schemaVersion":4}`)

	handler, err := newHandler(webRoot, t.TempDir(), func() error { return nil }, func() error { return nil })
	if err != nil {
		t.Fatalf("newHandler() error = %v", err)
	}

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	tests := []struct {
		name        string
		path        string
		wantStatus  int
		wantBody    string
		wantNoStore bool
	}{
		{name: "home", path: "/", wantStatus: http.StatusOK, wantBody: "CTG Engage", wantNoStore: true},
		{name: "content pack", path: "/experience.json", wantStatus: http.StatusOK, wantBody: `"schemaVersion":4`, wantNoStore: true},
		{name: "health", path: "/api/health", wantStatus: http.StatusOK, wantBody: `{"status":"ok"}`, wantNoStore: true},
		{name: "organization package", path: "/api/config", wantStatus: http.StatusOK, wantBody: `"activePackage":"ctg-ga"`, wantNoStore: true},
		{name: "missing asset", path: "/missing.png", wantStatus: http.StatusNotFound, wantBody: "404 page not found"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response, err := http.Get(server.URL + test.path)
			if err != nil {
				t.Fatalf("GET %s: %v", test.path, err)
			}
			defer response.Body.Close()

			body, err := io.ReadAll(response.Body)
			if err != nil {
				t.Fatalf("read response: %v", err)
			}
			if response.StatusCode != test.wantStatus {
				t.Errorf("status = %d, want %d", response.StatusCode, test.wantStatus)
			}
			if !strings.Contains(string(body), test.wantBody) {
				t.Errorf("body = %q, want it to contain %q", string(body), test.wantBody)
			}
			if test.wantNoStore && response.Header.Get("Cache-Control") != "no-store" {
				t.Errorf("Cache-Control = %q, want no-store", response.Header.Get("Cache-Control"))
			}
		})
	}
}

func TestHandlerServesConfiguredOrganizationPackage(t *testing.T) {
	t.Setenv("CTG_ENGAGE_PACKAGE", "alg-demo")
	webRoot := t.TempDir()
	writeTestFile(t, webRoot, "index.html", "Engage")

	handler, err := newHandler(webRoot, t.TempDir(), func() error { return nil }, func() error { return nil })
	if err != nil {
		t.Fatalf("newHandler() error = %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	var config struct {
		SchemaVersion int    `json:"schemaVersion"`
		ActivePackage string `json:"activePackage"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &config); err != nil {
		t.Fatalf("decode config: %v", err)
	}
	if config.SchemaVersion != 1 || config.ActivePackage != "alg-demo" {
		t.Fatalf("config = %#v", config)
	}
}

func TestHandlerRejectsInvalidOrganizationPackage(t *testing.T) {
	t.Setenv("CTG_ENGAGE_PACKAGE", "../ctg-ga")
	webRoot := t.TempDir()
	writeTestFile(t, webRoot, "index.html", "Engage")

	_, err := newHandler(webRoot, t.TempDir(), func() error { return nil }, func() error { return nil })
	if err == nil || !strings.Contains(err.Error(), "invalid organization package") {
		t.Fatalf("newHandler() error = %v, want invalid organization package", err)
	}
}

func TestHandlerRejectsMissingWebRoot(t *testing.T) {
	_, err := newHandler(filepath.Join(t.TempDir(), "missing"), t.TempDir(), func() error { return nil }, func() error { return nil })
	if err == nil {
		t.Fatal("newHandler() error = nil, want missing web root error")
	}
}

func TestHandlerRejectsWriteMethods(t *testing.T) {
	webRoot := t.TempDir()
	writeTestFile(t, webRoot, "index.html", "CTG Engage")

	handler, err := newHandler(webRoot, t.TempDir(), func() error { return nil }, func() error { return nil })
	if err != nil {
		t.Fatalf("newHandler() error = %v", err)
	}

	request := httptest.NewRequest(http.MethodPost, "/", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want %d", response.Code, http.StatusMethodNotAllowed)
	}
}

func TestHandlerRequiresOperatorAuthorization(t *testing.T) {
	webRoot := t.TempDir()
	writeTestFile(t, webRoot, "index.html", "CTG Engage")

	handler, err := newHandler(webRoot, t.TempDir(), func() error {
		t.Error("power-off action ran without operator authorization")
		return nil
	}, func() error { return nil })
	if err != nil {
		t.Fatalf("newHandler() error = %v", err)
	}

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	request, err := http.NewRequest(http.MethodPost, server.URL+"/api/operator/poweroff", nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	request.Header.Set("Origin", server.URL)

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("POST poweroff: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusForbidden {
		t.Errorf("status = %d, want %d", response.StatusCode, http.StatusForbidden)
	}
}

func TestHandlerAcceptsSameOriginPowerOff(t *testing.T) {
	webRoot := t.TempDir()
	writeTestFile(t, webRoot, "index.html", "CTG Engage")
	powerOffCalled := make(chan struct{}, 1)

	handler, err := newHandler(webRoot, t.TempDir(), func() error {
		powerOffCalled <- struct{}{}
		return nil
	}, func() error { return nil })
	if err != nil {
		t.Fatalf("newHandler() error = %v", err)
	}

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	sessionResponse, err := http.Get(server.URL + "/api/operator/session")
	if err != nil {
		t.Fatalf("GET operator session: %v", err)
	}
	defer sessionResponse.Body.Close()

	var session struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(sessionResponse.Body).Decode(&session); err != nil {
		t.Fatalf("decode operator session: %v", err)
	}
	if session.Token == "" {
		t.Fatal("operator session token is empty")
	}

	request, err := http.NewRequest(http.MethodPost, server.URL+"/api/operator/poweroff", nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	request.Header.Set("Origin", server.URL)
	request.Header.Set(operatorTokenHeader, session.Token)

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("POST poweroff: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusAccepted {
		t.Errorf("status = %d, want %d", response.StatusCode, http.StatusAccepted)
	}

	select {
	case <-powerOffCalled:
	case <-time.After(2 * time.Second):
		t.Fatal("power-off action was not called")
	}
}

func TestHandlerAcceptsSameOriginReboot(t *testing.T) {
	webRoot := t.TempDir()
	writeTestFile(t, webRoot, "index.html", "CTG Engage")
	rebootCalled := make(chan struct{}, 1)

	handler, err := newHandler(webRoot, t.TempDir(), func() error { return nil }, func() error {
		rebootCalled <- struct{}{}
		return nil
	})
	if err != nil {
		t.Fatalf("newHandler() error = %v", err)
	}

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	sessionResponse, err := http.Get(server.URL + "/api/operator/session")
	if err != nil {
		t.Fatalf("GET operator session: %v", err)
	}
	defer sessionResponse.Body.Close()

	var session struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(sessionResponse.Body).Decode(&session); err != nil {
		t.Fatalf("decode operator session: %v", err)
	}

	request, err := http.NewRequest(http.MethodPost, server.URL+"/api/operator/reboot", nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	request.Header.Set("Origin", server.URL)
	request.Header.Set(operatorTokenHeader, session.Token)

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("POST reboot: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusAccepted {
		t.Errorf("status = %d, want %d", response.StatusCode, http.StatusAccepted)
	}

	select {
	case <-rebootCalled:
	case <-time.After(2 * time.Second):
		t.Fatal("reboot action was not called")
	}
}

func TestHandlerRecordsInteractionEvent(t *testing.T) {
	webRoot := t.TempDir()
	dataRoot := t.TempDir()
	writeTestFile(t, webRoot, "index.html", "CTG Engage")
	handler, err := newHandler(webRoot, dataRoot, func() error { return nil }, func() error { return nil })
	if err != nil {
		t.Fatalf("newHandler() error = %v", err)
	}
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	body := `{"packageId":"ctg-ga","sessionId":"session-1234","event":"mission_completed","screen":"mission","branch":"yes","selections":["video-games","connection"],"elapsedMs":12500}`
	request, err := http.NewRequest(http.MethodPost, server.URL+"/api/events", strings.NewReader(body))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", server.URL)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("POST event: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusAccepted {
		t.Errorf("status = %d, want %d", response.StatusCode, http.StatusAccepted)
	}

	contents, err := os.ReadFile(filepath.Join(dataRoot, "interaction-events.jsonl"))
	if err != nil {
		t.Fatalf("read event log: %v", err)
	}
	var stored storedInteractionEvent
	if err := json.Unmarshal(contents, &stored); err != nil {
		t.Fatalf("decode event log: %v", err)
	}
	if stored.PackageID != "ctg-ga" || stored.Event != "mission_completed" || stored.Branch != "yes" || len(stored.Selections) != 2 {
		t.Fatalf("stored event = %#v", stored)
	}
	if stored.RecordedAt == "" {
		t.Fatal("stored event has no server timestamp")
	}
}

func TestHandlerRejectsCrossOriginInteractionEvent(t *testing.T) {
	webRoot := t.TempDir()
	writeTestFile(t, webRoot, "index.html", "CTG Engage")
	handler, err := newHandler(webRoot, t.TempDir(), func() error { return nil }, func() error { return nil })
	if err != nil {
		t.Fatalf("newHandler() error = %v", err)
	}
	request := httptest.NewRequest(http.MethodPost, "/api/events", strings.NewReader(`{"sessionId":"session-1234","event":"session_started","screen":"home","elapsedMs":0}`))
	request.Header.Set("Origin", "http://example.invalid")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Errorf("status = %d, want %d", response.Code, http.StatusForbidden)
	}
}

func writeTestFile(t *testing.T, root string, name string, contents string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(root, name), []byte(contents), 0o600); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
}
