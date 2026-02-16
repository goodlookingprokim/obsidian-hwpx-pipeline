# Changelog

All notable changes to this project will be documented in this file.

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
