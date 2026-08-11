from http.server import BaseHTTPRequestHandler
from html.parser import HTMLParser
from urllib.parse import unquote
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import base64
import html
import json
import os
import re


# ==========================================================
# Configuration
# ==========================================================

GITHUB_OWNER = "Maryam058"
GITHUB_REPO = "DocEngine"
GITHUB_BRANCH = "main"

GITHUB_TOKEN = os.environ.get("DOCENGINE_GITHUB_TOKEN")


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

                self.output.append(
                    "\n" + prefix
                )

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

        if self.in_pre:

            self.output.append(data)

            return

        self.output.append(
            html.unescape(data)
        )

    def get_markdown(self):

        text = "".join(
            self.output
        )

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
# GitHub API
# ==========================================================

def github_request(
    method,
    path,
    payload=None
):

    if not GITHUB_TOKEN:

        raise RuntimeError(
            "DOCENGINE_GITHUB_TOKEN is not configured."
        )

    url = (
        "https://api.github.com/repos/"
        f"{GITHUB_OWNER}/"
        f"{GITHUB_REPO}/"
        f"contents/{path}"
    )

    headers = {
        "Authorization":
            f"Bearer {GITHUB_TOKEN}",

        "Accept":
            "application/vnd.github+json",

        "X-GitHub-Api-Version":
            "2022-11-28",

        "User-Agent":
            "DocEngine-Publisher"
    }

    body = None

    if payload is not None:

        body = json.dumps(
            payload
        ).encode("utf-8")

        headers["Content-Type"] = (
            "application/json"
        )

    request = Request(
        url,
        data=body,
        headers=headers,
        method=method
    )

    try:

        with urlopen(
            request,
            timeout=30
        ) as response:

            response_body = (
                response.read()
                .decode("utf-8")
            )

            return json.loads(
                response_body
            )

    except HTTPError as error:

        error_body = (
            error.read()
            .decode("utf-8")
        )

        raise RuntimeError(
            f"GitHub API error "
            f"{error.code}: "
            f"{error_body}"
        )


# ==========================================================
# Convert Website URL → Markdown file path
# ==========================================================

def get_document_path(page):

    page_path = unquote(
        str(page)
    ).strip("/")

    # Remove GitHub Pages project prefix
    if page_path.startswith(
        "DocEngine/"
    ):

        page_path = page_path[
            len("DocEngine/"):
        ]

    if not page_path:

        return "index.md"

    # If editor already supplied .md
    if page_path.endswith(".md"):

        return page_path

    # MkDocs URLs normally end with /
    # Try the source Markdown filename first.
    #
    # Example:
    # UserGuide/Register a Patient/
    #
    # becomes:
    # UserGuide/Register a Patient.md

    if page_path.endswith("/"):

        page_path = page_path.rstrip("/")

    return page_path + ".md"


# ==========================================================
# Find actual file in GitHub
# ==========================================================

def find_github_file(page):

    candidate = get_document_path(page)

    candidates = [
        candidate
    ]

    # Also support index.md pages.
    if not candidate.endswith(
        "index.md"
    ):

        directory_index = (
          candidate[:-3]
           + "/index.md"
        )

        candidates.append(
            directory_index
        )

    for path in candidates:

        try:

            result = github_request(
                "GET",
                path
            )

            return path, result

        except RuntimeError as error:

            if "404" not in str(error):

                raise

    # If file does not exist, use
    # the primary candidate for creation.
    return candidate, None


# ==========================================================
# Publish
# ==========================================================

def publish_document(
    page,
    content
):

    markdown_content = (
        html_to_markdown(content)
    )

    file_path, existing = (
        find_github_file(page)
    )

    encoded_content = base64.b64encode(
        markdown_content.encode("utf-8")
    ).decode("utf-8")

    payload = {

        "message":
            f"Publish documentation: {file_path}",

        "content":
            encoded_content,

        "branch":
            GITHUB_BRANCH
    }

    if existing:

        payload["sha"] = existing["sha"]

    result = github_request(
        "PUT",
        file_path,
        payload
    )

    return {
        "success": True,

        "message":
            "Published successfully.",

        "file":
            file_path,

        "commit":
            result.get(
                "commit",
                {}
            ).get(
                "sha"
            )
    }


# ==========================================================
# Vercel Function
# ==========================================================

class handler(BaseHTTPRequestHandler):

    def send_json(
        self,
        status_code,
        data
    ):

        response = json.dumps(
            data
        ).encode("utf-8")

        self.send_response(
            status_code
        )

        self.send_header(
            "Content-Type",
            "application/json"
        )

        self.send_header(
            "Access-Control-Allow-Origin",
            "https://maryam058.github.io"
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
            response
        )
    def do_GET(self):

        self.send_json(
            200,
            {
                "success": True,
                "message": "DocEngine Publish API is running.",
                "method": "GET"
            }
        )

    def do_OPTIONS(self):

        self.send_response(204)
        self.send_header(
        "Access-Control-Allow-Origin",
        "https://maryam058.github.io"
    )
        self.send_header(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
    )
        self.send_header(
        "Access-Control-Allow-Headers",
        "Content-Type"
    )
        self.send_header(
        "Access-Control-Max-Age",
        "86400"
    )
        self.end_headers()

    def do_POST(self):

        try:

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

            page = data.get(
                "page"
            )

            content = data.get(
                "content"
            )

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

            result = publish_document(
                page,
                content
            )

            self.send_json(
                200,
                result
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
                    "message":
                        str(error)
                }
            )