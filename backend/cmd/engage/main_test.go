package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestHandlerServesKioskAndHealth(t *testing.T) {
	webRoot := t.TempDir()
	writeTestFile(t, webRoot, "index.html", "<title>CTG Engage</title>")
	writeTestFile(t, webRoot, "experience.json", `{"schemaVersion":4}`)

	handler, err := newHandler(webRoot)
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

func TestHandlerRejectsMissingWebRoot(t *testing.T) {
	_, err := newHandler(filepath.Join(t.TempDir(), "missing"))
	if err == nil {
		t.Fatal("newHandler() error = nil, want missing web root error")
	}
}

func TestHandlerRejectsWriteMethods(t *testing.T) {
	webRoot := t.TempDir()
	writeTestFile(t, webRoot, "index.html", "CTG Engage")

	handler, err := newHandler(webRoot)
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

func writeTestFile(t *testing.T, root string, name string, contents string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(root, name), []byte(contents), 0o600); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
}
