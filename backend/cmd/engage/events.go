package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unicode"
)

const (
	maxEventRequestBytes = 8 * 1024
	maxEventLogBytes     = 5 * 1024 * 1024
)

var allowedEventNames = map[string]bool{
	"session_started":   true,
	"opening_answered":  true,
	"mission_completed": true,
	"discovery_opened":  true,
	"chapter_opened":    true,
	"session_reset":     true,
	"idle_timeout":      true,
}

type interactionEvent struct {
	PackageID  string   `json:"packageId,omitempty"`
	SessionID  string   `json:"sessionId"`
	Event      string   `json:"event"`
	Screen     string   `json:"screen"`
	Branch     string   `json:"branch,omitempty"`
	Target     string   `json:"target,omitempty"`
	Reason     string   `json:"reason,omitempty"`
	Selections []string `json:"selections,omitempty"`
	ElapsedMS  int64    `json:"elapsedMs"`
}

type storedInteractionEvent struct {
	RecordedAt string `json:"recordedAt"`
	interactionEvent
}

type eventStore struct {
	path string
	mu   sync.Mutex
}

func newEventStore(dataRoot string) (*eventStore, error) {
	root, err := filepath.Abs(dataRoot)
	if err != nil {
		return nil, fmt.Errorf("resolve data root: %w", err)
	}
	if err := os.MkdirAll(root, 0o750); err != nil {
		return nil, fmt.Errorf("create data root %s: %w", root, err)
	}
	info, err := os.Stat(root)
	if err != nil {
		return nil, fmt.Errorf("open data root %s: %w", root, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("data root %s is not a directory", root)
	}
	return &eventStore{path: filepath.Join(root, "interaction-events.jsonl")}, nil
}

func (store *eventStore) handle(w http.ResponseWriter, r *http.Request) {
	if !requestIsSameOrigin(r) {
		http.Error(w, "same-origin request required", http.StatusForbidden)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxEventRequestBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	var event interactionEvent
	if err := decoder.Decode(&event); err != nil {
		http.Error(w, "invalid event", http.StatusBadRequest)
		return
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		http.Error(w, "invalid event", http.StatusBadRequest)
		return
	}
	if err := validateInteractionEvent(event); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := store.append(event); err != nil {
		http.Error(w, "event could not be recorded", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusAccepted)
}

func validateInteractionEvent(event interactionEvent) error {
	if event.PackageID != "" && !validOrganizationPackageID(event.PackageID) {
		return fmt.Errorf("invalid package id")
	}
	if len(event.SessionID) < 8 || !validEventValue(event.SessionID, 80) {
		return fmt.Errorf("invalid session id")
	}
	if !allowedEventNames[event.Event] {
		return fmt.Errorf("invalid event name")
	}
	for _, value := range []string{event.Screen, event.Branch, event.Target, event.Reason} {
		if !validEventValue(value, 100) {
			return fmt.Errorf("invalid event value")
		}
	}
	if len(event.Selections) > 10 {
		return fmt.Errorf("too many selections")
	}
	for _, selection := range event.Selections {
		if selection == "" || !validEventValue(selection, 100) {
			return fmt.Errorf("invalid selection")
		}
	}
	if event.ElapsedMS < 0 || event.ElapsedMS > int64((24*time.Hour)/time.Millisecond) {
		return fmt.Errorf("invalid elapsed time")
	}
	return nil
}

func validEventValue(value string, maxLength int) bool {
	if len(value) > maxLength || strings.ContainsAny(value, "\r\n") {
		return false
	}
	for _, character := range value {
		if unicode.IsControl(character) {
			return false
		}
	}
	return true
}

func (store *eventStore) append(event interactionEvent) error {
	entry, err := json.Marshal(storedInteractionEvent{
		RecordedAt:       time.Now().UTC().Format(time.RFC3339Nano),
		interactionEvent: event,
	})
	if err != nil {
		return err
	}
	entry = append(entry, '\n')

	store.mu.Lock()
	defer store.mu.Unlock()

	if info, err := os.Stat(store.path); err == nil && info.Size()+int64(len(entry)) > maxEventLogBytes {
		backupPath := store.path + ".1"
		if err := os.Remove(backupPath); err != nil && !os.IsNotExist(err) {
			return err
		}
		if err := os.Rename(store.path, backupPath); err != nil {
			return err
		}
	} else if err != nil && !os.IsNotExist(err) {
		return err
	}

	file, err := os.OpenFile(store.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o640)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = file.Write(entry)
	return err
}
