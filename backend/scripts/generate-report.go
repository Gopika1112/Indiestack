// generate-report creates a markdown test report from go test JSON output.
// Usage: go test -json ./... | go run scripts/generate-report.go
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"sort"
	"time"
)

type TestEvent struct {
	Time    time.Time `json:"Time"`
	Action  string    `json:"Action"`
	Package string    `json:"Package"`
	Test    string    `json:"Test"`
	Output  string    `json:"Output"`
	Elapsed float64   `json:"Elapsed"`
}

func main() {
	outFile := flag.String("out", "", "Output markdown file (default: stdout)")
	flag.Parse()

	var (
		passed      int
		failed      int
		skipped     int
		packages    = make(map[string]*packageResult)
		failures    []string
		skipReasons []string
	)

	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := scanner.Text()
		var ev TestEvent
		if err := json.Unmarshal([]byte(line), &ev); err != nil {
			continue
		}

		if _, ok := packages[ev.Package]; !ok {
			packages[ev.Package] = &packageResult{Name: ev.Package}
		}
		pkg := packages[ev.Package]

		switch ev.Action {
		case "pass":
			if ev.Test == "" {
				pkg.Status = "PASS"
				pkg.Elapsed = ev.Elapsed
			} else {
				passed++
			}
		case "fail":
			if ev.Test == "" {
				pkg.Status = "FAIL"
				pkg.Elapsed = ev.Elapsed
			} else {
				failed++
				failures = append(failures, fmt.Sprintf("%s/%s", ev.Package, ev.Test))
			}
		case "skip":
			if ev.Test != "" {
				skipped++
				skipReasons = append(skipReasons, fmt.Sprintf("%s/%s", ev.Package, ev.Test))
			}
		}
	}

	// Sort package names.
	var names []string
	for name := range packages {
		if name != "" {
			names = append(names, name)
		}
	}
	sort.Strings(names)

	var b bytes.Buffer

	fmt.Fprintln(&b, "# IndieStack Module 9 Test Report")
	fmt.Fprintln(&b, "")
	fmt.Fprintf(&b, "Generated: %s\n", time.Now().UTC().Format(time.RFC3339))
	fmt.Fprintln(&b, "")
	fmt.Fprintln(&b, "## Summary")
	fmt.Fprintln(&b, "")
	fmt.Fprintf(&b, "- Passed tests: %d\n", passed)
	fmt.Fprintf(&b, "- Failed tests: %d\n", failed)
	fmt.Fprintf(&b, "- Skipped tests: %d\n", skipped)
	fmt.Fprintf(&b, "- Overall: %s\n", overallStatus(failed))
	fmt.Fprintln(&b, "")
	fmt.Fprintln(&b, "## Package Results")
	fmt.Fprintln(&b, "")
	fmt.Fprintln(&b, "| Package | Status | Elapsed (s) |")
	fmt.Fprintln(&b, "|---------|--------|-------------|")
	for _, name := range names {
		pkg := packages[name]
		fmt.Fprintf(&b, "| %s | %s | %.3f |\n", name, pkg.Status, pkg.Elapsed)
	}

	if len(failures) > 0 {
		fmt.Fprintln(&b, "")
		fmt.Fprintln(&b, "## Failed Tests")
		fmt.Fprintln(&b, "")
		for _, f := range failures {
			fmt.Fprintf(&b, "- %s\n", f)
		}
	}

	if len(skipReasons) > 0 {
		fmt.Fprintln(&b, "")
		fmt.Fprintln(&b, "## Skipped Tests")
		fmt.Fprintln(&b, "")
		for _, s := range skipReasons {
			fmt.Fprintf(&b, "- %s\n", s)
		}
	}

	fmt.Fprintln(&b, "")
	fmt.Fprintln(&b, "## How to Run")
	fmt.Fprintln(&b, "")
	fmt.Fprintln(&b, "```bash")
	fmt.Fprintln(&b, "# Unit tests")
	fmt.Fprintln(&b, "go test -v ./internal/validate/... ./internal/auth/... ./internal/testutil/...")
	fmt.Fprintln(&b, "")
	fmt.Fprintln(&b, "# Integration tests (requires test database)")
	fmt.Fprintln(&b, "export TEST_DATABASE_URL=postgres://indiestack:indiestack_secret@localhost:5432/indiestack_test?sslmode=disable")
	fmt.Fprintln(&b, "go test -v ./tests/integration/...")
	fmt.Fprintln(&b, "")
	fmt.Fprintln(&b, "# Live API tests (requires running stack)")
	fmt.Fprintln(&b, "export TEST_API_URL=http://localhost:8080/api/v1")
	fmt.Fprintln(&b, "go test -v ./tests/integration/... -run 'TestAPI|TestPublic|TestRegister|TestLogin'")
	fmt.Fprintln(&b, "```")

	if *outFile != "" {
		if err := os.WriteFile(*outFile, b.Bytes(), 0644); err != nil {
			fmt.Fprintf(os.Stderr, "failed to write report: %v\n", err)
			os.Exit(1)
		}
	} else {
		os.Stdout.Write(b.Bytes())
	}
}

type packageResult struct {
	Name    string
	Status  string
	Elapsed float64
}

func overallStatus(failed int) string {
	if failed == 0 {
		return "✅ PASS"
	}
	return "❌ FAIL"
}
