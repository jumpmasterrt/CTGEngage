package main

import (
	"bufio"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
)

const maxContactRequestBytes = 16 * 1024

var zipPattern = regexp.MustCompile(`^\d{5}(?:-\d{4})?$`)

type contactSubmission struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	ZIP      string `json:"zip"`
	Interest string `json:"interest"`
	Consent  bool   `json:"consent"`
}

type storedContact struct {
	RecordedAt string `json:"recordedAt"`
	contactSubmission
}

type contactStore struct {
	path string
	mu   sync.Mutex
}

func newContactStore(dataRoot string) (*contactStore, error) {
	root, err := filepath.Abs(dataRoot)
	if err != nil {
		return nil, fmt.Errorf("resolve data root: %w", err)
	}
	if err := os.MkdirAll(root, 0o750); err != nil {
		return nil, fmt.Errorf("create data root %s: %w", root, err)
	}
	return &contactStore{
		path: filepath.Join(root, "visitor-contacts.jsonl"),
	}, nil
}

func (store *contactStore) handleCreate(w http.ResponseWriter, r *http.Request) {
	if !requestIsSameOrigin(r) {
		http.Error(w, "same-origin request required", http.StatusForbidden)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxContactRequestBytes)

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	var submission contactSubmission
	if err := decoder.Decode(&submission); err != nil {
		http.Error(w, "invalid contact submission", http.StatusBadRequest)
		return
	}

	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		http.Error(w, "invalid contact submission", http.StatusBadRequest)
		return
	}

	submission.Name = strings.TrimSpace(submission.Name)
	submission.Email = strings.TrimSpace(submission.Email)
	submission.Phone = strings.TrimSpace(submission.Phone)
	submission.ZIP = strings.TrimSpace(submission.ZIP)
	submission.Interest = strings.Join(strings.Fields(submission.Interest), " ")

	if err := validateContactSubmission(submission); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := store.append(submission); err != nil {
		http.Error(w, "contact could not be recorded", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "saved",
	})
}

func validateContactSubmission(submission contactSubmission) error {
	if !validContactValue(submission.Name, 120) || submission.Name == "" {
		return fmt.Errorf("name is required")
	}
	if !validContactValue(submission.Email, 200) {
		return fmt.Errorf("invalid email")
	}
	if !validContactValue(submission.Phone, 60) {
		return fmt.Errorf("invalid phone")
	}
	if submission.Email == "" && submission.Phone == "" {
		return fmt.Errorf("email or phone is required")
	}
	if !zipPattern.MatchString(submission.ZIP) {
		return fmt.Errorf("valid ZIP code is required")
	}
	if !validContactValue(submission.Interest, 500) {
		return fmt.Errorf("interest is too long")
	}
	if !submission.Consent {
		return fmt.Errorf("permission to contact is required")
	}
	return nil
}

func validContactValue(value string, maxLength int) bool {
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

func (store *contactStore) append(submission contactSubmission) error {
	entry, err := json.Marshal(storedContact{
		RecordedAt:        time.Now().UTC().Format(time.RFC3339Nano),
		contactSubmission: submission,
	})
	if err != nil {
		return err
	}
	entry = append(entry, '\n')

	store.mu.Lock()
	defer store.mu.Unlock()

	file, err := os.OpenFile(store.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o640)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.Write(entry)
	return err
}

func (store *contactStore) readAll() ([]storedContact, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	file, err := os.Open(store.path)
	if os.IsNotExist(err) {
		return []storedContact{}, nil
	}
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var contacts []storedContact
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		if strings.TrimSpace(scanner.Text()) == "" {
			continue
		}

		var contact storedContact
		if err := json.Unmarshal(scanner.Bytes(), &contact); err != nil {
			return nil, err
		}
		contacts = append(contacts, contact)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return contacts, nil
}

func (store *contactStore) count() (int, error) {
	contacts, err := store.readAll()
	if err != nil {
		return 0, err
	}
	return len(contacts), nil
}

func (store *contactStore) clear() error {
	store.mu.Lock()
	defer store.mu.Unlock()

	if err := os.Remove(store.path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (store *contactStore) exportCSV() (string, int, error) {
	contacts, err := store.readAll()
	if err != nil {
		return "", 0, err
	}
	if len(contacts) == 0 {
		return "", 0, fmt.Errorf("no contacts to export")
	}

	root, err := findExportRoot()
	if err != nil {
		return "", 0, err
	}

	filename := fmt.Sprintf(
		"ctg-engage-contacts-%s.csv",
		time.Now().Format("2006-01-02-150405"),
	)
	path := filepath.Join(root, filename)

	file, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o640)
	if err != nil {
		return "", 0, err
	}
	defer file.Close()

	writer := csv.NewWriter(file)

	if err := writer.Write([]string{
		"Recorded At",
		"Name",
		"Email",
		"Phone",
		"ZIP",
		"Interest",
		"Permission To Contact",
	}); err != nil {
		return "", 0, err
	}

	for _, contact := range contacts {
		if err := writer.Write([]string{
			contact.RecordedAt,
			safeCSVValue(contact.Name),
			safeCSVValue(contact.Email),
			safeCSVValue(contact.Phone),
			safeCSVValue(contact.ZIP),
			safeCSVValue(contact.Interest),
			"Yes",
		}); err != nil {
			return "", 0, err
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return "", 0, err
	}

	return path, len(contacts), nil
}

func safeCSVValue(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}

	switch value[0] {
	case '=', '+', '-', '@':
		return "'" + value
	default:
		return value
	}
}

func findExportRoot() (string, error) {
	if configured := strings.TrimSpace(os.Getenv("CTG_ENGAGE_EXPORT_ROOT")); configured != "" {
		root, err := filepath.Abs(configured)
		if err != nil {
			return "", err
		}
		if err := verifyWritableDirectory(root); err != nil {
			return "", fmt.Errorf("configured export location unavailable: %w", err)
		}
		return root, nil
	}

	if runtime.GOOS == "windows" {
		return "", fmt.Errorf("no export location configured")
	}

	file, err := os.Open("/proc/mounts")
	if err != nil {
		return "", fmt.Errorf("USB storage could not be detected")
	}
	defer file.Close()

	var candidates []string
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}

		mountPoint := decodeMountPath(fields[1])

		if strings.HasPrefix(mountPoint, "/media/") ||
			strings.HasPrefix(mountPoint, "/run/media/") ||
			strings.HasPrefix(mountPoint, "/mnt/") {
			candidates = append(candidates, mountPoint)
		}
	}

	if err := scanner.Err(); err != nil {
		return "", fmt.Errorf("read mount table: %w", err)
	}

	sort.Strings(candidates)

	for _, candidate := range candidates {
		if err := verifyWritableDirectory(candidate); err == nil {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("no writable USB storage found")
}

func decodeMountPath(value string) string {
	replacer := strings.NewReplacer(
		`\040`, " ",
		`\011`, "\t",
		`\012`, "\n",
		`\134`, `\`,
	)
	return replacer.Replace(value)
}

func verifyWritableDirectory(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("%s is not a directory", path)
	}

	testFile := filepath.Join(
		path,
		fmt.Sprintf(".ctg-engage-write-test-%d", time.Now().UnixNano()),
	)

	file, err := os.OpenFile(testFile, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	_ = file.Close()
	_ = os.Remove(testFile)

	return nil
}
