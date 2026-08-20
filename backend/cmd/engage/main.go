package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

func main() {
	webRoot := environmentOrDefault("CTG_ENGAGE_WEB", "www")
	handler, err := newHandler(webRoot)
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

func newHandler(webRoot string) (http.Handler, error) {
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

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
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
