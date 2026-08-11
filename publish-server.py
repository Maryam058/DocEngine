from http.server import BaseHTTPRequestHandler, HTTPServer
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote
import base64
import html
import json
import os
import re
import urllib.error
import urllib.request


# ==========================================================
# Configuration
# ==========================================================

GITHUB_OWNER = "Maryam058"
GITHUB_REPO = "DocEngine"
GITHUB_BRANCH = "main"

DOCS_ROOT = Path(__file__).resolve().parent / "docs"

GITHUB_API = (
    f"https://api.github.com/repos/"
    f"{GITHUB_OWNER}/{GITHUB_REPO}/contents"
)


# ==========================================================
# HTML → Markdown
# ==========================================================

class MarkdownConverter(HTMLParser):

    def __init__(self):
        super().__init__()
        self.output = []
        self.list_stack = []
        self.link_stack = []
        self.in_pre = False

    def handle_starttag(self, tag, attrs):

        attrs = dict(attrs)

        if tag == "h1":
            self.output.append("\n\n# ")

        elif tag == "h2":
            self.output.append("\n\n## ")

        elif tag == "h3":
            self.output.append("\n\n### ")

        elif tag == "h4":
            self.output.append("\n\n#### ")

        elif tag == "p":
            self.output.append("\n\n")

        elif tag == "br":
            self.output.append("\n")

        elif tag in ("strong", "b"):
            self.output.append("**")

        elif tag in ("em", "i"):
            self.output.append("*")

        elif tag == "u":
            self.output.append("<u>")

        elif tag == "s":
            self.output.append("~~")

        elif tag == "blockquote":
            self.output.append("\n\n> ")

        elif tag == "pre":
            self.output.append("\n\n```\n")
            self.in_pre = True

        elif tag == "code":
            if not self.in_pre:
                self.output.append("`")

        elif tag == "ol":
            self.list_stack.append({
                "type": "ordered",
                "number": 1
            })

        elif tag == "ul":
            self.list_stack.append({
                "type": "unordered",
                "number": 1
            })

        elif tag == "li":

            if self.list_stack:

                current = self.list_stack[-1]

                if current["type"] == "ordered":
                    prefix = f"{current['number']}. "
                    current["number"] += 1
                else:
                    prefix = "- "

                self.output.append("\n" + prefix)

        elif tag == "a":

            href = attrs.get("href", "")

            self.link_stack.append(href)

            self.output.append("[")

        elif tag == "img":

            src = attrs.get("src", "")
            alt = attrs.get("alt", "")

            if src:
                self.output.append(
                    f"![{alt}]({src})"
                )

    def handle_endtag(self, tag):

        if tag in ("h1", "h2", "h3", "h4"):
            self.output.append("\n")

        elif tag == "p":
            self.output.append("\n")

        elif tag in ("strong", "b"):
            self.output.append("**")

        elif tag in ("em", "i"):
            self.output.append("*")

        elif tag == "u":
            self.output.append("</u>")

        elif tag == "s":
            self.output.append("~~")

        elif tag == "blockquote":
            self.output.append("\n")

        elif tag == "pre":
            self.output.append("\n```\n")
            self.in_pre = False

        elif tag == "code":

            if not self.in_pre:
                self.output.append("`")

        elif tag in ("ol", "ul"):

            if self.list_stack:
                self.list_stack.pop()

            self.output.append("\n")

        elif tag == "a":

            href = ""

            if self.link_stack:
                href = self.link_stack.pop()

            self.output.append(
                f"]({href})"
            )

        elif tag == "li":
            self.output.append("\n")

    def handle_data(self, data):

        if not data:
            return

        self.output.append(
            html.unescape(data)
        )

    def get_markdown(self):

        text = "".join(self.output)

        text = re.sub(
            r"\n{3,}",
            "\n\n",
            text
        )

        text = re.sub(
            r"[ \t]+\n",
            "\n",
            text
        )

        return text.strip() + "\n"


def html_to_markdown(content):

    converter = MarkdownConverter()

    converter.feed(content)

    converter.close()

    return converter.get_markdown()


# ==========================================================
# GitHub API helpers
# ==========================================================

def get_github_token():

    token = os.environ.get(
        "DOCENGINE_GITHUB_TOKEN"
    )

    if not token:

        raise RuntimeError(
            "DOCENGINE_GITHUB_TOKEN is not configured."
        )

    return token


def github_request(
    method,
    url,
    token,
    payload=None
):

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "DocEngine-Publisher"
    }

    body = None

    if payload is not None:

        body = json.dumps(
            payload
        ).encode("utf-8")

        headers["Content-Type"] = (
            "application/json"
        )

    request = urllib.request.Request(
        url,
        data=body,
        headers=headers,
        method=method
    )

    try:

        with urllib.request.urlopen(
            request,
            timeout=20
        ) as response:

            response_body = response.read()

            return json.loads(
                response_body.decode("utf-8")
            )

    except urllib.error.HTTPError as error:

        error_body = error.read().decode(
            "utf-8",
            errors="replace"
        )

        raise RuntimeError(
            f"GitHub API error "
            f"{error.code}: {error_body}"
        )


def find_github_file(
    github_path,
    token
):

    url = (
        f"{GITHUB_API}/"
        f"{github_path}"
        f"?ref={GITHUB_BRANCH}"
    )

    try:

        return github_request(
            "GET",
            url,
            token
        )

    except RuntimeError as error:

        if "404" in str(error):

            return None

        raise


def publish_to_github(
    github_path,
    markdown_content
):

    token = get_github_token()

    encoded_content = base64.b64encode(
        markdown_content.encode("utf-8")
    ).decode("ascii")

    existing_file = find_github_file(
        github_path,
        token
    )

    payload = {
        "message":
            f"Publish documentation: {github_path}",
        "content": encoded_content,
        "branch": GITHUB_BRANCH
    }

    if existing_file:

        payload["sha"] = existing_file["sha"]

    url = (
        f"{GITHUB_API}/"
        f"{github_path}"
    )

    return github_request(
        "PUT",
        url,
        token,
        payload
    )


# ==========================================================
# Publish Handler
# ==========================================================

class PublishHandler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):

        self.send_response(200)

        self.send_header(
            "Access-Control-Allow-Origin",
            "*"
        )

        self.send_header(
            "Access-Control-Allow-Methods",
            "POST, OPTIONS"
        )

        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type"
        )

        self.end_headers()

    def do_POST(self):

        if self.path != "/publish":

            self.send_json(
                404,
                {
                    "success": False,
                    "message":
                        "Publish endpoint not found."
                }
            )

            return

        try:

            # --------------------------------------------------
            # Read request
            # --------------------------------------------------

            content_length = int(
                self.headers.get(
                    "Content-Length",
                    0
                )
            )

            body = self.rfile.read(
                content_length
            )

            data = json.loads(
                body.decode("utf-8")
            )

            page = data.get("page")
            content = data.get("content")

            if not page or content is None:

                self.send_json(
                    400,
                    {
                        "success": False,
                        "message":
                            "Page and content are required."
                    }
                )

                return

            # --------------------------------------------------
            # Convert page path
            # --------------------------------------------------

            page_path = unquote(
                page
            ).strip("/")

            if page_path.startswith(
                "DocEngine/"
            ):

                page_path = page_path[
                    len("DocEngine/"):
                ]

            # Convert URL-style page path
            # to repository docs path.

            if not page_path:

                page_path = "index.md"

            elif page_path.endswith("/"):

                page_path += "index.md"

            elif not page_path.endswith(".md"):

                page_path += ".md"

            github_path = (
                f"docs/{page_path}"
            )

            # --------------------------------------------------
            # Convert editor HTML → Markdown
            # --------------------------------------------------

            markdown_content = (
                html_to_markdown(content)
            )

            print(
                f"Publishing to GitHub: "
                f"{github_path}"
            )

            # --------------------------------------------------
            # Publish through GitHub API
            # --------------------------------------------------

            result = publish_to_github(
                github_path,
                markdown_content
            )

            print(
                "GitHub commit successful."
            )

            self.send_json(
                200,
                {
                    "success": True,
                    "message":
                        "Published to GitHub successfully.",
                    "file":
                        github_path,
                    "commit":
                        result.get(
                            "commit",
                            {}
                        ).get(
                            "sha"
                        )
                }
            )

        except Exception as error:

            print(
                "Publish error:",
                error
            )

            self.send_json(
                500,
                {
                    "success": False,
                    "message": str(error)
                }
            )

    def send_json(
        self,
        status_code,
        data
    ):

        response = json.dumps(
            data
        )

        self.send_response(
            status_code
        )

        self.send_header(
            "Content-Type",
            "application/json"
        )

        self.send_header(
            "Access-Control-Allow-Origin",
            "*"
        )

        self.send_header(
            "Access-Control-Allow-Methods",
            "POST, OPTIONS"
        )

        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type"
        )

        self.end_headers()

        self.wfile.write(
            response.encode("utf-8")
        )


# ==========================================================
# Start server
# ==========================================================

def run_server():

    port = int(os.environ.get("PORT", 5000))

    server = HTTPServer(
        ("0.0.0.0", port),
        PublishHandler
    )

    print(
        "DocEngine GitHub Publish Server running at:"
    )

    print(
    f"http://0.0.0.0:{port}"
    )

    server.serve_forever()


if __name__ == "__main__":

    run_server()