package web

import "embed"

//go:embed all:site
var SiteFS embed.FS // marketing site, served at /

//go:embed all:app
var AppFS embed.FS // dashboard + status page, served at /dashboard and /status
