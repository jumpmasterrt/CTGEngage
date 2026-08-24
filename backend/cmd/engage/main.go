package main

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	operatorTokenHeader        = "X-CTG-Operator-Token"
	defaultOrganizationPackage = "ctg-ga"
)

var organizationPackagePattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

func main() {
	webRoot := environmentOrDefault("CTG_ENGAGE_WEB", "www")
	dataRoot := environmentOrDefault("CTG_ENGAGE_DATA", "data")
	handler, err := newHandler(webRoot, dataRoot, systemPowerOff, systemReboot)
	if err != nil {
		log.Fatal(err)
	}

	address := environmentOrDefault("CTG_ENGAGE_LISTEN", "127.0.0.1:8080")
	server := &http.Server{
		Addr:              address,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("CTG Engage serving %s at http://%s", webRoot, address)
	log.Fatal(server.ListenAndServe())
}

func newHandler(webRoot string, dataRoot string, powerOff func() error, reboot func() error) (http.Handler, error) {
	if powerOff == nil || reboot == nil {
		return nil, fmt.Errorf("power actions are required")
	}

	root, err := filepath.Abs(webRoot)
	if err != nil {
		return nil, fmt.Errorf("resolve web root: %w", err)
	}

	info, err := os.Stat(root)
	if err != nil {
		return nil, fmt.Errorf("open web root %s: %w", root, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("web root %s is not a directory", root)
	}
	if _, err := os.Stat(filepath.Join(root, "index.html")); err != nil {
		return nil, fmt.Errorf("web root %s has no index.html: %w", root, err)
	}
	activePackage := environmentOrDefault("CTG_ENGAGE_PACKAGE", defaultOrganizationPackage)
	if !validOrganizationPackageID(activePackage) {
		return nil, fmt.Errorf("invalid organization package %q", activePackage)
	}

	operatorToken, err := newOperatorToken()
	if err != nil {
		return nil, fmt.Errorf("create operator token: %w", err)
	}
	events, err := newEventStore(dataRoot)
	if err != nil {
		return nil, fmt.Errorf("open event store: %w", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("GET /api/config", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"schemaVersion": 1,
			"activePackage": activePackage,
		})
	})
	mux.HandleFunc("GET /api/operator/session", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		_ = json.NewEncoder(w).Encode(map[string]string{"token": operatorToken})
	})
	mux.HandleFunc("POST /api/events", events.handle)

	var powerActionOnce sync.Once
	registerPowerAction := func(pattern string, status string, action func() error) {
		mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
			providedToken := r.Header.Get(operatorTokenHeader)
			validToken := subtle.ConstantTimeCompare([]byte(providedToken), []byte(operatorToken)) == 1
			if !requestIsSameOrigin(r) || !validToken {
				http.Error(w, "operator authorization required", http.StatusForbidden)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Cache-Control", "no-store")
			w.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(w).Encode(map[string]string{"status": status})
			if flusher, ok := w.(http.Flusher); ok {
				flusher.Flush()
			}

			powerActionOnce.Do(func() {
				go func() {
					time.Sleep(750 * time.Millisecond)
					if err := action(); err != nil {
						log.Printf("system power action failed: %v", err)
					}
				}()
			})
		})
	}
	registerPowerAction("POST /api/operator/poweroff", "shutting-down", powerOff)
	registerPowerAction("POST /api/operator/reboot", "restarting", reboot)

	staticFiles := http.FileServer(http.Dir(root))
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		w.Header().Set("X-Content-Type-Options", "nosniff")
		if r.URL.Path == "/" || r.URL.Path == "/index.html" || r.URL.Path == "/active-package.json" || strings.HasSuffix(r.URL.Path, "/experience.json") || strings.HasSuffix(r.URL.Path, "/manifest.json") {
			w.Header().Set("Cache-Control", "no-store")
		}
		staticFiles.ServeHTTP(w, r)
	}))

	return mux, nil
}

func validOrganizationPackageID(value string) bool {
	return len(value) <= 64 && organizationPackagePattern.MatchString(value)
}

func environmentOrDefault(name string, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func newOperatorToken() (string, error) {
	token := make([]byte, 32)
	if _, err := rand.Read(token); err != nil {
		return "", err
	}
	return hex.EncodeToString(token), nil
}

func requestIsSameOrigin(r *http.Request) bool {
	return r.Header.Get("Origin") == "http://"+r.Host
}

func systemPowerOff() error {
	return systemPowerAction("PowerOff")
}

func systemReboot() error {
	return systemPowerAction("Reboot")
}

func systemPowerAction(method string) error {
	command := exec.Command(
		"/usr/bin/busctl",
		"call",
		"org.freedesktop.login1",
		"/org/freedesktop/login1",
		"org.freedesktop.login1.Manager",
		method,
		"b",
		"false",
	)
	output, err := command.CombinedOutput()
	if err != nil {
		return fmt.Errorf("systemd-logind %s: %w: %s", method, err, strings.TrimSpace(string(output)))
	}
	return nil
}
