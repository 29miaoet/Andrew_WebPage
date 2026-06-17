# Contributing
Thanks for your interest in contributing to this project.

## Table of Contents
- [Getting Started](#getting-started)
  - [Command Line](#command-line)
  - [GUI](#gui)
- [Requirements for contribution](#requirements-for-contribution)
- [Guidelines](#guidelines)
  - [General guidelines](#general-guidelines)
  - [Project specific guidelines](#project-specific-guidelines)

## Getting Started

### Command Line
1. Clone & Run Locally
```shell
git clone https://github.com/29miaoet/Andrew_WebPage.git
cd Andrew_WebPage
# Start a local server with python
python -m http.server 8000
# or use node.js
npx http-server
```
Navigate to http://localhost:8000/ in your browser.
> Note: Some features require JavaScript fetch. Direct file:// access won't work for all functionality.

2. Make your changes
```shell
# Edit the file
# Create a branch
git checkout -b your-branch-name
# Add changes and commit
git add .
git commit -m "describe your changes"
# Push to GitHub
git push -u origin your-branch-name
# Open a pull request on GitHub
```
> Note: If you are pushing for the first time, you will need to create a personal access token for github [here](https://github.com/settings/personal-access-tokens/new).

### GUI
1. Fork the repository to your own account.
2. Make your changes.
3. Click **Contribute → Open pull request**.
4. Create a pull request.

## Requirements for contribution
Any contributions are always a help to this repository, even fixing a small typo can help improve this project.
For a list of easy-beginner friendly contributions, see the [issues](https://github.com/29miaoet/Andrew_WebPage/issues).

## Guidelines
You do not need to follow these guidelines when contributing, but please take a look at them and treat them as suggestions for contribution.

### General guidelines
- New files or folders should be organized in the same fashion as the existing structure.
- Prefer simple solutions over complex or complicated ones.
- Prefer functional solutions over simple ones.
- Use LF line returns instead of CRLF or CR whenever possible.

### Project specific guidelines
- Prefer aria-labels for accessibility over direct `<label>` tags.
- Use JavaScript event listeners instead of `onclick` attributes.
- Background color schemes should be light blue, preferably between `#e8f6ff` and `#9cd6ff`.
- Use normal HTML syntax instead of XHTML syntax.
