# Installation

This guide helps you install DocEngine and prepare it for first-time use.

## System Requirements

Before you begin, make sure your environment meets the following requirements:

- A supported operating system such as Windows, macOS, or Linux
- Python 3.9 or later
- Internet access to download dependencies
- Sufficient disk space for the documentation tools and generated site files

## Install Dependencies

1. Open a terminal in the project folder.
2. Create a virtual environment:

   ```bash
   python -m venv .venv
   ```

3. Activate the virtual environment:

   - Windows:

     ```bash
     .\.venv\Scripts\activate
     ```

   - macOS or Linux:

     ```bash
     source .venv/bin/activate
     ```

4. Install the required packages:

   ```bash
   pip install -r requirements.txt
   ```

## Verify Installation

After installation, verify that the tools are available:

```bash
python -m mkdocs --version
```

If the command returns a version number, the installation is complete.

## Screenshot Placeholder

![Installation screen placeholder](https://via.placeholder.com/1200x600?text=Installation+Screen)

### Annotation Notes

- Screenshot title: Installing DocEngine in a terminal
- What should be captured: A terminal window showing the virtual environment creation, activation, and dependency installation steps.
- Highlight area: The command prompt and the installation commands should be emphasized.
- Arrow placement: Place a single arrow pointing to the `pip install -r requirements.txt` command.
- Callout text: "Run this command to install the required packages."
- Caption: "Install the required dependencies from the project folder before starting DocEngine."

## Next Steps

After installation, continue to the usage guide to start building and previewing your documentation.
