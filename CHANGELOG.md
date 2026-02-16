# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- New modal workflow for user convenience:
  - `HWPX 3단계 워크플로우 코치 열기`
  - `HWPX 외부 LLM 프롬프트 키트 열기`
- Default hotkeys for modal-centric operation:
  - `Mod + Shift + H` (workflow coach)
  - `Mod + Shift + L` (external LLM prompt kit)
  - `Mod + Shift + A` (built-in AI assist, optional)
  - `Mod + Shift + T` (template manager)
- External-LLM-first prompt templates optimized for Markdown -> HWPX export quality.

### Changed
- Docs portal copy behavior now limits inline copy buttons to `https://` values only.

### Docs
- Updated documentation set (`README`, `Install`, `UserGuide`, `Developer`, `Showcase`, `Project`, `TroubleShooting`, `DocumentationPlan`) to reflect:
  - snippet execution labels (`개별 실행`, `동시 실행 가능`)
  - copy-button behavior
  - GitHub Pages doc portal usage
- Updated user/developer guides for 3-step operation:
  1) HWPX import
  2) external LLM collaboration
  3) HWPX export

## [1.1.0] - 2026-02-16

### Added
- File conflict policy options: `ask`, `version`, `skip`, `overwrite`.
- Import/export preview modals with summary and confirmation.
- Batch import command for multiple HWPX files.
- Template management modal for listing, adding, replacing, linking, and deleting templates.
- Pipeline guide actions for import, AI assist, export, batch import, and template manager.
- New safety utility module for path validation, filename sanitization, frontmatter stripping, and AI context preparation.
- Expanded integration tests for round-trip assertions, security utility checks, and large markdown durability.

### Changed
- Export pipeline now reuses the first paragraph placeholder to avoid empty first paragraph output.
- Import metadata no longer stores full template base64 by default.
- Full pipeline command semantics were updated from direct import to guided workflow modal.
- Installation script now copies sample files only when `--copy-samples` is explicitly provided.

### Security
- API key defaults to session-only storage and is masked in settings UI.
- AI context controls added: source mode, frontmatter stripping, max length limits, truncation notice.
- Unsafe paths and filename patterns are rejected/sanitized before vault writes.
- API error body exposure is truncated to reduce sensitive payload leakage in notices.

### Docs
- README updated for new operations, safety defaults, and recommended settings.

## [1.0.0] - 2026-02-13

### Added
- Initial release with HWPX import/export pipeline and AI writing integration.
