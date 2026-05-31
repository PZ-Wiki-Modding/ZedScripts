.ONESHELL:
.PHONY: help build test package release

SHELL := /bin/bash
UPDATE_TYPE ?= patch# can be "patch", "minor" or "major"

help:
	@echo "ZedScripts"
	@echo "Available targets:"
	@echo "  build:   Build the extension"
	@echo "  test:    Run tests"
	@echo "  package: Package the extension"
	@echo "  release: Publish to VS Code Marketplace and Open VSX"

build:
	npm run build

package:
	vsce package

pat:
	vsce verify-pat

test:
	npx @vscode/test-cli
	npm run test:jest

release: pat test
	set -euo pipefail

# publish to registries (VS Code Marketplace and Open VSX)
	vsce publish "$(UPDATE_TYPE)"
	npx ovsx publish

# get version from package.json
	VERSION=$$(node -e "console.log(require('./package.json').version)")

# release to GitHub
	git push --tags
	vsce package
	gh release create "v$$VERSION" "project-zomboid-scripts-$$VERSION.vsix" \
		--notes "See [Changelog](https://github.com/SirDoggyJvla/ZedScripts/blob/main/README.md#Changelog) for details"
	git push