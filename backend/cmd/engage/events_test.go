package main

import "testing"

func TestValidateInteractionEventAcceptsSourceOpened(t *testing.T) {
	event := interactionEvent{
		PackageID: "ctg-ga",
		SessionID: "session-1234",
		Event:     "source_opened",
		Screen:    "chapter",
		Target:    "https://www.vfw.org/media-and-events/latest-releases/archives/2025/11/waking-up-with-the-vfw",
		ElapsedMS: 12500,
	}

	if err := validateInteractionEvent(event); err != nil {
		t.Fatalf("validateInteractionEvent() error = %v", err)
	}
}
