from flask import Flask, request, jsonify
from pathlib import Path

app = Flask(__name__)


@app.post("/save")
def save():

    data = request.json

    file_path = Path(
        data["file"]
    )


    content = data["content"]


    file_path.write_text(
        content,
        encoding="utf-8"
    )


    return jsonify(
        {
            "status":"saved"
        }
    )


app.run(
    port=5001
)