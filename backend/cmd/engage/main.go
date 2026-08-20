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
	"strings"
	"sync"
	"time"
)

const operatorTokenHeader = "X-CTG-Operator-Token"

func main() {
	webRoot := environmentOrDefault("CTG_ENGAGE_WEB", "www")
	handler, err := newHandler(webRoot, systemPowerOff)
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

func newHandler(webRoot string, powerOff func() error) (http.Handler, error) {
	if powerOff == nil {
		return nil, fmt.Errorf("power-off action is required")
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

	operatorToken, err := newOperatorToken()
	if err != nil {
		return nil, fmt.Errorf("create operator token: %w", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("GET /api/operator/session", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		_ = json.NewEncoder(w).Encode(map[string]string{"token": operatorToken})
	})

	var powerOffOnce sync.Once
	mux.HandleFunc("POST /api/operator/poweroff", func(w http.ResponseWriter, r *http.Request) {
		providedToken := r.Header.Get(operatorTokenHeader)
		validToken := subtle.ConstantTimeCompare([]byte(providedToken), []byte(operatorToken)) == 1
		if r.Header.Get("Origin") != "http://"+r.Host || !validToken {
			http.Error(w, "operator authorization required", http.StatusForbidden)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "shutting-down"})
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}

		powerOffOnce.Do(func() {
			go func() {
				time.Sleep(750 * time.Millisecond)
				if err := powerOff(); err != nil {
					log.Printf("clean shutdown failed: %v", err)
				}
			}()
		})
	})

	staticFiles := http.FileServer(http.Dir(root))
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		w.Header().Set("X-Content-Type-Options", "nosniff")
		if r.URL.Path == "/" || r.URL.Path == "/index.html" || r.URL.Path == "/experience.json" || r.URL.Path == "/manifest.json" {
			w.Header().Set("Cache-Control", "no-store")
		}
		staticFiles.ServeHTTP(w, r)
	}))

	return mux, nil
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

func systemPowerOff() error {
	command := exec.Command(
		"/usr/bin/busctl",
		"call",
		"org.freedesktop.login1",
		"/org/freedesktop/login1",
		"org.freedesktop.login1.Manager",
		"PowerOff",
		"b",
		"false",
	)
	output, err := command.CombinedOutput()
	if err != nil {
		return fmt.Errorf("systemd-logind poweroff: %w: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}
