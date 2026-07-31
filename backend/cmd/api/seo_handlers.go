package main

import (
	"encoding/xml"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// ============================================================
// RSS FEED HANDLERS
// ============================================================

// rssItem represents a single RSS 2.0 item.
type rssItem struct {
	XMLName     xml.Name `xml:"item"`
	Title       string   `xml:"title"`
	Link        string   `xml:"link"`
	Description string   `xml:"description"`
	PubDate     string   `xml:"pubDate"`
	GUID        string   `xml:"guid"`
	Author      string   `xml:"author,omitempty"`
}

// rssChannel represents the RSS 2.0 channel.
type rssChannel struct {
	XMLName       xml.Name  `xml:"channel"`
	Title         string    `xml:"title"`
	Link          string    `xml:"link"`
	Description   string    `xml:"description"`
	Language      string    `xml:"language"`
	LastBuildDate string    `xml:"lastBuildDate"`
	Items         []rssItem `xml:"item"`
}

// rssFeed is the top-level RSS document.
type rssFeed struct {
	XMLName xml.Name   `xml:"rss"`
	Version string     `xml:"version,attr"`
	Channel rssChannel `xml:"channel"`
}

func getBaseURL() string {
	base := os.Getenv("NEXT_PUBLIC_APP_URL")
	if base == "" {
		base = "http://localhost:8080"
	}
	return strings.TrimRight(base, "/")
}

func rssHandler(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/rss")
	path = strings.TrimPrefix(path, "/")

	// /rss/{username} — per-author feed
	if path != "" && path != "latest" {
		rssUserHandler(w, r, path)
		return
	}

	// /rss or /rss/latest — global latest feed
	rssLatestHandler(w, r)
}

func rssLatestHandler(w http.ResponseWriter, r *http.Request) {
	baseURL := getBaseURL()

	rows, err := db.Query(`
		SELECT p.title, p.excerpt, p.slug, p.published_at, u.username, u.display_name
		FROM posts p JOIN users u ON p.author_id = u.id
		WHERE p.status = 'published'
		ORDER BY p.published_at DESC NULLS LAST
		LIMIT 50`)
	if err != nil {
		log.Printf("RSS query error: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := make([]rssItem, 0)
	for rows.Next() {
		var title, excerpt, slug, username, displayName string
		var publishedAt *time.Time
		if err := rows.Scan(&title, &excerpt, &slug, &publishedAt, &username, &displayName); err != nil {
			continue
		}
		pubDate := ""
		if publishedAt != nil {
			pubDate = publishedAt.Format(time.RFC1123Z)
		}
		author := displayName
		if author == "" {
			author = username
		}
		items = append(items, rssItem{
			Title:       title,
			Link:        fmt.Sprintf("%s/%s/%s", baseURL, username, slug),
			Description: excerpt,
			PubDate:     pubDate,
			GUID:        fmt.Sprintf("%s/%s/%s", baseURL, username, slug),
			Author:      author,
		})
	}
	if err := rows.Err(); err != nil {
		log.Printf("RSS rows error: %v", err)
	}
	if items == nil {
		items = []rssItem{}
	}

	feed := rssFeed{
		Version: "2.0",
		Channel: rssChannel{
			Title:         "IndieStack — Latest Posts",
			Link:          baseURL,
			Description:   "Latest published posts from IndieStack writers.",
			Language:      "en",
			LastBuildDate: time.Now().Format(time.RFC1123Z),
			Items:         items,
		},
	}

	w.Header().Set("Content-Type", "application/rss+xml; charset=utf-8")
	w.Write([]byte(xml.Header))
	enc := xml.NewEncoder(w)
	enc.Indent("", "  ")
	if err := enc.Encode(feed); err != nil {
		log.Printf("RSS encode error: %v", err)
	}
}

func rssUserHandler(w http.ResponseWriter, r *http.Request, username string) {
	baseURL := getBaseURL()

	// Verify user exists
	var displayName string
	err := db.QueryRow(`SELECT display_name FROM users WHERE username = $1`, username).Scan(&displayName)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	rows, err := db.Query(`
		SELECT p.title, p.excerpt, p.slug, p.published_at, u.username, u.display_name
		FROM posts p JOIN users u ON p.author_id = u.id
		WHERE u.username = $1 AND p.status = 'published'
		ORDER BY p.published_at DESC NULLS LAST
		LIMIT 50`, username)
	if err != nil {
		log.Printf("RSS user query error: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := make([]rssItem, 0)
	for rows.Next() {
		var title, excerpt, slug, uname, dname string
		var publishedAt *time.Time
		if err := rows.Scan(&title, &excerpt, &slug, &publishedAt, &uname, &dname); err != nil {
			continue
		}
		pubDate := ""
		if publishedAt != nil {
			pubDate = publishedAt.Format(time.RFC1123Z)
		}
		author := dname
		if author == "" {
			author = uname
		}
		items = append(items, rssItem{
			Title:       title,
			Link:        fmt.Sprintf("%s/%s/%s", baseURL, uname, slug),
			Description: excerpt,
			PubDate:     pubDate,
			GUID:        fmt.Sprintf("%s/%s/%s", baseURL, uname, slug),
			Author:      author,
		})
	}
	if err := rows.Err(); err != nil {
		log.Printf("RSS user rows error: %v", err)
	}
	if items == nil {
		items = []rssItem{}
	}

	authorName := displayName
	if authorName == "" {
		authorName = username
	}

	feed := rssFeed{
		Version: "2.0",
		Channel: rssChannel{
			Title:         fmt.Sprintf("IndieStack — %s", authorName),
			Link:          fmt.Sprintf("%s/%s", baseURL, username),
			Description:   fmt.Sprintf("Latest published posts from %s on IndieStack.", authorName),
			Language:      "en",
			LastBuildDate: time.Now().Format(time.RFC1123Z),
			Items:         items,
		},
	}

	w.Header().Set("Content-Type", "application/rss+xml; charset=utf-8")
	w.Write([]byte(xml.Header))
	enc := xml.NewEncoder(w)
	enc.Indent("", "  ")
	if err := enc.Encode(feed); err != nil {
		log.Printf("RSS user encode error: %v", err)
	}
}

// ============================================================
// SITEMAP HANDLER
// ============================================================

// sitemapURL represents a single URL entry in the sitemap.
type sitemapURL struct {
	XMLName    xml.Name `xml:"url"`
	Loc        string   `xml:"loc"`
	LastMod    string   `xml:"lastmod,omitempty"`
	ChangeFreq string   `xml:"changefreq,omitempty"`
	Priority   string   `xml:"priority,omitempty"`
}

// sitemapIndex is the root sitemap element.
type sitemapIndex struct {
	XMLName xml.Name     `xml:"urlset"`
	Xmlns   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

func sitemapHandler(w http.ResponseWriter, r *http.Request) {
	baseURL := getBaseURL()

	urls := []sitemapURL{
		{Loc: baseURL, ChangeFreq: "daily", Priority: "1.0"},
		{Loc: baseURL + "/feed", ChangeFreq: "hourly", Priority: "0.9"},
		{Loc: baseURL + "/discover", ChangeFreq: "hourly", Priority: "0.8"},
		{Loc: baseURL + "/explore", ChangeFreq: "daily", Priority: "0.7"},
		{Loc: baseURL + "/about", ChangeFreq: "monthly", Priority: "0.5"},
		{Loc: baseURL + "/pricing", ChangeFreq: "monthly", Priority: "0.5"},
		{Loc: baseURL + "/jobs", ChangeFreq: "daily", Priority: "0.6"},
	}

	// Add all published posts
	rows, err := db.Query(`
		SELECT p.slug, p.published_at, u.username
		FROM posts p JOIN users u ON p.author_id = u.id
		WHERE p.status = 'published'
		ORDER BY p.published_at DESC NULLS LAST
		LIMIT 50000`)
	if err != nil {
		log.Printf("Sitemap query error: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var slug, username string
		var publishedAt *time.Time
		if err := rows.Scan(&slug, &publishedAt, &username); err != nil {
			continue
		}
		lastMod := ""
		if publishedAt != nil {
			lastMod = publishedAt.Format("2006-01-02")
		}
		urls = append(urls, sitemapURL{
			Loc:        fmt.Sprintf("%s/%s/%s", baseURL, username, slug),
			LastMod:    lastMod,
			ChangeFreq: "weekly",
			Priority:   "0.8",
		})
	}
	if err := rows.Err(); err != nil {
		log.Printf("Sitemap rows error: %v", err)
	}

	// Add user profile pages
	userRows, err := db.Query(`SELECT username FROM users ORDER BY username LIMIT 10000`)
	if err == nil {
		defer userRows.Close()
		for userRows.Next() {
			var username string
			if err := userRows.Scan(&username); err != nil {
				continue
			}
			urls = append(urls, sitemapURL{
				Loc:        fmt.Sprintf("%s/%s", baseURL, username),
				ChangeFreq: "daily",
				Priority:   "0.6",
			})
		}
	}

	index := sitemapIndex{
		Xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9",
		URLs:  urls,
	}

	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Write([]byte(xml.Header))
	enc := xml.NewEncoder(w)
	enc.Indent("", "  ")
	if err := enc.Encode(index); err != nil {
		log.Printf("Sitemap encode error: %v", err)
	}
}

// ============================================================
// ROBOTS.TXT HANDLER
// ============================================================

func robotsHandler(w http.ResponseWriter, r *http.Request) {
	baseURL := getBaseURL()
	robots := fmt.Sprintf(`User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /settings
Disallow: /api/

Sitemap: %s/sitemap.xml
`, baseURL)

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(robots))
}
