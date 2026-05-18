package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strings"
	"syscall/js"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"
)

var defaultConf *model.Configuration

func init() {
	api.DisableConfigDir()
	defaultConf = model.NewDefaultConfiguration()
}

type MergeConfig struct {
	DividerPage bool `json:"dividerPage"`
}

type SplitConfig struct {
	Pages string `json:"pages"`
	Span  int    `json:"span"`
}

type RotateConfig struct {
	Rotation int    `json:"rotation"`
	Pages    string `json:"pages"`
}

type WatermarkConfig struct {
	Text     string `json:"text"`
	Opacity  string `json:"opacity"`
	Rotation string `json:"rotation"`
	Pages    string `json:"pages"`
	OnTop    bool   `json:"onTop"`
	Position string `json:"position"` // center, top-left, top-right, bottom-left, bottom-right
	FontSize int    `json:"fontSize"`
	Color    string `json:"color"` // #RRGGBB
}

type OptimizeConfig struct {
	Quality string `json:"quality"` // low | medium | high
}

type RemovePagesConfig struct {
	Pages string `json:"pages"`
}

type MetadataConfig struct {
	Title    string `json:"title"`
	Author   string `json:"author"`
	Subject  string `json:"subject"`
	Keywords string `json:"keywords"`
	Creator  string `json:"creator"`
}

func jsValueToBytes(arg js.Value) ([]byte, error) {
	length := arg.Get("byteLength").Int()
	if length == 0 {
		return nil, fmt.Errorf("empty input")
	}
	data := make([]byte, length)
	js.CopyBytesToGo(data, arg)
	return data, nil
}

func bytesToJsUint8Array(data []byte) js.Value {
	jsArr := js.Global().Get("Uint8Array").New(len(data))
	js.CopyBytesToJS(jsArr, data)
	return jsArr
}

func parseJSONConfig[T any](configStr string) (*T, error) {
	if configStr == "" {
		return nil, nil
	}
	var config T
	err := json.Unmarshal([]byte(configStr), &config)
	if err != nil {
		return nil, fmt.Errorf("invalid config JSON: %v", err)
	}
	return &config, nil
}

func parsePages(pageStr string) []string {
	if pageStr == "" {
		return nil
	}
	pages, _ := api.ParsePageSelection(pageStr)
	return pages
}

func jsIsArray(v js.Value) bool {
	if v.Type() != js.TypeObject {
		return false
	}
	return js.Global().Get("Array").Call("isArray", v).Bool()
}

func pdfcpuMerge(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"ok": false, "error": "merge requires array of PDF bytes as first argument"}
	}

	if !jsIsArray(args[0]) {
		return map[string]any{"ok": false, "error": "first argument must be an array of PDF Uint8Arrays"}
	}

	arr := args[0]
	length := arr.Length()
	if length < 2 {
		return map[string]any{"ok": false, "error": "need at least 2 PDFs to merge"}
	}

	dividerPage := false
	if len(args) > 1 && args[1].Type() == 1 {
		if c, err := parseJSONConfig[MergeConfig](args[1].String()); err != nil {
			return map[string]any{"ok": false, "error": err.Error()}
		} else if c != nil {
			dividerPage = c.DividerPage
		}
	}

	var readers []io.ReadSeeker
	for i := 0; i < length; i++ {
		data, err := jsValueToBytes(arr.Index(i))
		if err != nil {
			return map[string]any{"ok": false, "error": fmt.Sprintf("failed to read PDF at index %d: %v", i, err)}
		}
		readers = append(readers, bytes.NewReader(data))
	}

	var buf bytes.Buffer
	err := api.MergeRaw(readers, &buf, dividerPage, defaultConf)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	return map[string]any{"ok": true, "data": bytesToJsUint8Array(buf.Bytes())}
}

func splitCommaRanges(s string) []string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func pdfcpuSplit(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"ok": false, "error": "split requires PDF bytes as first argument"}
	}

	inputBytes, err := jsValueToBytes(args[0])
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	type splitResult struct {
		From int    `json:"from"`
		Thru int    `json:"thru"`
		Data []byte `json:"data"`
	}

	pagesMode := ""
	span := 1
	if len(args) > 1 && args[1].Type() == 1 {
		if c, err := parseJSONConfig[SplitConfig](args[1].String()); err != nil {
			return map[string]any{"ok": false, "error": err.Error()}
		} else if c != nil {
			pagesMode = strings.TrimSpace(c.Pages)
			span = c.Span
		}
	}

	pageCount, err := api.PageCount(bytes.NewReader(inputBytes), defaultConf)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	if pagesMode != "" {
		segments := splitCommaRanges(pagesMode)
		if len(segments) == 0 {
			return map[string]any{"ok": false, "error": "invalid page range"}
		}
		var results []splitResult
		for _, seg := range segments {
			selectedPages := parsePages(strings.TrimSpace(seg))
			if len(selectedPages) == 0 {
				return map[string]any{"ok": false, "error": "invalid page range"}
			}
			if _, err := api.PagesForPageSelection(pageCount, selectedPages, false, false); err != nil {
				return map[string]any{"ok": false, "error": fmt.Sprintf("page range exceeds the document's %d pages", pageCount)}
			}
			pn, err := api.PagesForPageCollection(pageCount, selectedPages)
			if err != nil || len(pn) == 0 {
				return map[string]any{"ok": false, "error": "invalid page range"}
			}
			sort.Ints(pn)
			from, thru := pn[0], pn[len(pn)-1]

			reader := bytes.NewReader(inputBytes)
			var buf bytes.Buffer
			if err := api.Trim(reader, &buf, selectedPages, defaultConf); err != nil {
				return map[string]any{"ok": false, "error": err.Error()}
			}
			results = append(results, splitResult{From: from, Thru: thru, Data: buf.Bytes()})
		}
		jsonData, _ := json.Marshal(results)
		return map[string]any{"ok": true, "data": string(jsonData)}
	}

	if span < 1 {
		return map[string]any{"ok": false, "error": "invalid span"}
	}
	if span >= pageCount {
		return map[string]any{"ok": false, "error": fmt.Sprintf("page range exceeds the document's %d pages", pageCount)}
	}

	reader := bytes.NewReader(inputBytes)
	pageSpans, err := api.SplitRaw(reader, span, defaultConf)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	var results []splitResult
	for _, ps := range pageSpans {
		data, err := io.ReadAll(ps.Reader)
		if err != nil {
			return map[string]any{"ok": false, "error": fmt.Sprintf("failed to read split part %d-%d: %v", ps.From, ps.Thru, err)}
		}
		results = append(results, splitResult{
			From: ps.From,
			Thru: ps.Thru,
			Data: data,
		})
	}

	jsonData, _ := json.Marshal(results)
	return map[string]any{"ok": true, "data": string(jsonData)}
}

func pdfcpuRotate(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"ok": false, "error": "rotate requires PDF bytes as first argument"}
	}

	inputBytes, err := jsValueToBytes(args[0])
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	rotation := 90
	pages := ""

	if len(args) > 1 && args[1].Type() == 1 {
		if c, err := parseJSONConfig[RotateConfig](args[1].String()); err != nil {
			return map[string]any{"ok": false, "error": err.Error()}
		} else if c != nil {
			rotation = c.Rotation
			pages = c.Pages
		}
	}

	reader := bytes.NewReader(inputBytes)
	var buf bytes.Buffer

	err = api.Rotate(reader, &buf, rotation, parsePages(pages), defaultConf)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	return map[string]any{"ok": true, "data": bytesToJsUint8Array(buf.Bytes())}
}

func pdfcpuValidate(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"ok": false, "error": "validate requires PDF bytes as first argument"}
	}

	inputBytes, err := jsValueToBytes(args[0])
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	reader := bytes.NewReader(inputBytes)
	err = api.Validate(reader, defaultConf)
	if err != nil {
		return map[string]any{"ok": false, "error": fmt.Sprintf("validation failed: %v", err)}
	}

	return map[string]any{"ok": true, "data": "valid"}
}

func optimizeConfForQuality(q string) *model.Configuration {
	c := *defaultConf
	switch strings.ToLower(strings.TrimSpace(q)) {
	case "low":
		c.Optimize = true
		c.OptimizeBeforeWriting = false
		c.OptimizeResourceDicts = false
		c.OptimizeDuplicateContentStreams = false
	case "high":
		c.Optimize = true
		c.OptimizeBeforeWriting = true
		c.OptimizeResourceDicts = true
		c.OptimizeDuplicateContentStreams = true
	default: // medium
		c.Optimize = true
		c.OptimizeBeforeWriting = true
		c.OptimizeResourceDicts = true
		c.OptimizeDuplicateContentStreams = false
	}
	return &c
}

func pdfcpuOptimize(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"ok": false, "error": "optimize requires PDF bytes as first argument"}
	}

	inputBytes, err := jsValueToBytes(args[0])
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	conf := defaultConf
	if len(args) > 1 && args[1].Type() == 1 {
		if c, err := parseJSONConfig[OptimizeConfig](args[1].String()); err != nil {
			return map[string]any{"ok": false, "error": err.Error()}
		} else if c != nil && c.Quality != "" {
			conf = optimizeConfForQuality(c.Quality)
		}
	}

	reader := bytes.NewReader(inputBytes)
	var buf bytes.Buffer

	err = api.Optimize(reader, &buf, conf)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	return map[string]any{"ok": true, "data": bytesToJsUint8Array(buf.Bytes())}
}

func pdfcpuPageCount(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"ok": false, "error": "pageCount requires PDF bytes as first argument"}
	}
	inputBytes, err := jsValueToBytes(args[0])
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}
	n, err := api.PageCount(bytes.NewReader(inputBytes), defaultConf)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}
	return map[string]any{"ok": true, "data": n}
}

func watermarkAnchorDesc(pos string) string {
	switch strings.ToLower(strings.TrimSpace(pos)) {
	case "top-left":
		return "tl"
	case "top-right":
		return "tr"
	case "bottom-left":
		return "bl"
	case "bottom-right":
		return "br"
	default:
		return "c"
	}
}

func pdfcpuExtractPages(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"ok": false, "error": "extractPages requires PDF bytes as first argument"}
	}

	inputBytes, err := jsValueToBytes(args[0])
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	pages := ""
	if len(args) > 1 && args[1].Type() == 1 {
		if c, err := parseJSONConfig[RemovePagesConfig](args[1].String()); err != nil {
			return map[string]any{"ok": false, "error": err.Error()}
		} else if c != nil {
			pages = c.Pages
		}
	}

	if pages == "" {
		return map[string]any{"ok": false, "error": "extractPages requires 'pages' in config JSON (e.g., '1-3,5,7-10')"}
	}

	selectedPages := parsePages(pages)
	if len(selectedPages) == 0 {
		return map[string]any{"ok": false, "error": "invalid page selection"}
	}

	reader := bytes.NewReader(inputBytes)
	var buf bytes.Buffer

	err = api.Trim(reader, &buf, selectedPages, defaultConf)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	return map[string]any{"ok": true, "data": bytesToJsUint8Array(buf.Bytes())}
}

func pdfcpuAddWatermark(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"ok": false, "error": "addWatermark requires PDF bytes as first argument"}
	}

	inputBytes, err := jsValueToBytes(args[0])
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	text := "WATERMARK"
	opacity := "0.3"
	rotation := "45"
	pages := ""
	onTop := true
	position := "center"
	fontSizeWM := 48
	colorHex := "#808080"

	if len(args) > 1 && args[1].Type() == 1 {
		if c, err := parseJSONConfig[WatermarkConfig](args[1].String()); err != nil {
			return map[string]any{"ok": false, "error": err.Error()}
		} else if c != nil {
			if c.Text != "" {
				text = c.Text
			}
			if c.Opacity != "" {
				opacity = c.Opacity
			}
			if c.Rotation != "" {
				rotation = c.Rotation
			}
			pages = c.Pages
			onTop = c.OnTop
			if c.Position != "" {
				position = c.Position
			}
			if c.FontSize > 0 {
				fontSizeWM = c.FontSize
			}
			if c.Color != "" {
				colorHex = c.Color
			}
		}
	}

	posKey := watermarkAnchorDesc(position)
	fontSize := fontSizeWM
	if fontSize < 1 {
		fontSize = 48
	}
	color := strings.TrimSpace(colorHex)
	if color == "" {
		color = "#808080"
	}
	desc := fmt.Sprintf("position:%s, points:%d, color:%s, opacity:%s, rotation:%s",
		posKey, fontSize, color, opacity, rotation)
	wm, err := api.TextWatermark(text, desc, onTop, false, types.POINTS)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	reader := bytes.NewReader(inputBytes)
	var buf bytes.Buffer

	err = api.AddWatermarks(reader, &buf, parsePages(pages), wm, defaultConf)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	return map[string]any{"ok": true, "data": bytesToJsUint8Array(buf.Bytes())}
}

func pdfcpuRemovePages(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"ok": false, "error": "removePages requires PDF bytes as first argument"}
	}

	inputBytes, err := jsValueToBytes(args[0])
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	pages := ""
	if len(args) > 1 && args[1].Type() == 1 {
		if c, err := parseJSONConfig[RemovePagesConfig](args[1].String()); err != nil {
			return map[string]any{"ok": false, "error": err.Error()}
		} else if c != nil {
			pages = c.Pages
		}
	}

	if pages == "" {
		return map[string]any{"ok": false, "error": "removePages requires 'pages' in config JSON (e.g., '1-3,5,7-10')"}
	}

	selectedPages := parsePages(pages)
	if len(selectedPages) == 0 {
		return map[string]any{"ok": false, "error": "invalid page selection"}
	}

	reader := bytes.NewReader(inputBytes)
	var buf bytes.Buffer

	err = api.RemovePages(reader, &buf, selectedPages, defaultConf)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	return map[string]any{"ok": true, "data": bytesToJsUint8Array(buf.Bytes())}
}

func pdfcpuSetMetadata(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"ok": false, "error": "setMetadata requires PDF bytes as first argument"}
	}

	inputBytes, err := jsValueToBytes(args[0])
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	properties := make(map[string]string)

	if len(args) > 1 && args[1].Type() == 1 {
		if c, err := parseJSONConfig[MetadataConfig](args[1].String()); err != nil {
			return map[string]any{"ok": false, "error": err.Error()}
		} else if c != nil {
			if c.Title != "" {
				properties["Title"] = c.Title
			}
			if c.Author != "" {
				properties["Author"] = c.Author
			}
			if c.Subject != "" {
				properties["Subject"] = c.Subject
			}
			if c.Keywords != "" {
				properties["Keywords"] = c.Keywords
			}
			if c.Creator != "" {
				properties["Creator"] = c.Creator
			}
		}
	}

	if len(properties) == 0 {
		return map[string]any{"ok": false, "error": "setMetadata requires at least one property in config JSON"}
	}

	reader := bytes.NewReader(inputBytes)
	var buf bytes.Buffer

	err = api.AddProperties(reader, &buf, properties, defaultConf)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	return map[string]any{"ok": true, "data": bytesToJsUint8Array(buf.Bytes())}
}

func main() {
	js.Global().Set("pdfcpuMerge", js.FuncOf(pdfcpuMerge))
	js.Global().Set("pdfcpuSplit", js.FuncOf(pdfcpuSplit))
	js.Global().Set("pdfcpuRotate", js.FuncOf(pdfcpuRotate))
	js.Global().Set("pdfcpuValidate", js.FuncOf(pdfcpuValidate))
	js.Global().Set("pdfcpuOptimize", js.FuncOf(pdfcpuOptimize))
	js.Global().Set("pdfcpuPageCount", js.FuncOf(pdfcpuPageCount))
	js.Global().Set("pdfcpuExtractPages", js.FuncOf(pdfcpuExtractPages))
	js.Global().Set("pdfcpuAddWatermark", js.FuncOf(pdfcpuAddWatermark))
	js.Global().Set("pdfcpuRemovePages", js.FuncOf(pdfcpuRemovePages))
	js.Global().Set("pdfcpuSetMetadata", js.FuncOf(pdfcpuSetMetadata))
	versionObj := js.Global().Get("Object").New()
	versionObj.Set("version", "0.11.1")
	js.Global().Set("pdfcpuVersion", versionObj)

	<-make(chan struct{})
}
