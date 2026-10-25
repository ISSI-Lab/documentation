#!/usr/bin/env python3
"""Integration test for LaTeX file move and folder file management.

Tests:
1. Authentication with demo credentials.
2. Creating a LaTeX document.
3. Creating a folder in LaTeX workspace.
4. Creating a text doc under a specific folder (folder_id).
5. Moving a text doc from root to folder using POST /latex/move.
6. Moving a text doc from folder back to root using POST /latex/move.
7. Uploading a binary file asset directly under a folder.
8. Moving a binary file asset between folder and root.
9. Renaming folder and verifying child paths.
10. Deleting folder and verifying cascade.
"""

import sys
import json
import base64
import urllib.request
import urllib.error

BASE_URL = "http://localhost:5000/api/v1"

class Response:
    def __init__(self, status_code, body_bytes):
        self.status_code = status_code
        self.text = body_bytes.decode("utf-8") if body_bytes else ""

    def json(self):
        return json.loads(self.text) if self.text else {}

def request(method, path, body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return Response(resp.status, resp.read())
    except urllib.error.HTTPError as e:
        return Response(e.code, e.read())

def run():
    print("=== Testing LaTeX File Move & Folder Files ===")

    # 1. Login
    login_resp = request("POST", "/auth/login", {"usernameOrEmail": "demo_organizer", "password": "Password123!"})
    if login_resp.status_code != 200:
        login_resp = request("POST", "/auth/login", {"usernameOrEmail": "demo_user", "password": "Password123!"})
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json()["token"]
    user = login_resp.json()["user"]
    print(f"✓ Logged in as {user.get('name', 'user')}")

    # 2. Get a template
    tpl_resp = request("GET", "/templates", token=token)
    assert tpl_resp.status_code == 200, f"Get templates failed: {tpl_resp.text}"
    templates = tpl_resp.json()
    assert len(templates) > 0, "No templates found"
    tpl_id = templates[0]["id"]

    # 3. Create LaTeX Document
    create_doc_resp = request("POST", "/documents", {
        "title": "LaTeX Move Test Document",
        "description": "Integration test for moving files into folders",
        "template_id": tpl_id,
        "category": "latex",
        "scope": "personal",
        "tags": ["test", "latex"],
    }, token=token)
    assert create_doc_resp.status_code in (200, 201), f"Create doc failed: {create_doc_resp.text}"
    doc = create_doc_resp.json()
    doc_id = doc["id"]
    print(f"✓ Created LaTeX document: {doc_id}")

    # 3. Get Workspace
    ws_resp = request("GET", f"/documents/{doc_id}/latex", token=token)
    assert ws_resp.status_code == 200, f"Get workspace failed: {ws_resp.text}"
    ws = ws_resp.json()
    print(f"✓ Initial workspace loaded: {len(ws.get('docs', []))} docs, {len(ws.get('folders', []))} folders")

    # 4. Create a Folder
    fld_resp = request("POST", f"/documents/{doc_id}/latex/folder", {"name": "chapters"}, token=token)
    assert fld_resp.status_code in (200, 201), f"Create folder failed: {fld_resp.text}"
    fld = fld_resp.json()
    fld_id = fld["id"]
    print(f"✓ Created folder 'chapters' with ID {fld_id}")

    # 5. Create a file directly under the folder
    child_doc_resp = request("POST", f"/documents/{doc_id}/latex/doc", {
        "name": "ch1.tex",
        "folder_id": fld_id,
        "content": "\\section{Chapter 1}\nThis is chapter 1."
    }, token=token)
    assert child_doc_resp.status_code in (200, 201), f"Create child doc failed: {child_doc_resp.text}"
    child_doc = child_doc_resp.json()
    assert child_doc.get("folder_id") == fld_id, f"Expected folder_id {fld_id}, got {child_doc.get('folder_id')}"
    assert "chapters/ch1.tex" in child_doc.get("path", ""), f"Expected path to contain chapters/ch1.tex, got {child_doc.get('path')}"
    print(f"✓ Created child document 'ch1.tex' directly in folder 'chapters': path = {child_doc['path']}")

    # 6. Create a root document
    root_doc_resp = request("POST", f"/documents/{doc_id}/latex/doc", {
        "name": "appendix.tex",
        "folder_id": None,
        "content": "\\section{Appendix}\nSupplementary details."
    }, token=token)
    assert root_doc_resp.status_code in (200, 201), f"Create root doc failed: {root_doc_resp.text}"
    root_doc = root_doc_resp.json()
    root_doc_id = root_doc["id"]
    assert root_doc.get("folder_id") is None
    print(f"✓ Created root document 'appendix.tex' with ID {root_doc_id}")

    # 7. Move root document into folder 'chapters'
    move_resp = request("POST", f"/documents/{doc_id}/latex/move", {
        "entity_id": root_doc_id,
        "entity_type": "doc",
        "target_folder_id": fld_id
    }, token=token)
    assert move_resp.status_code == 200, f"Move doc to folder failed: {move_resp.text}"
    moved_data = move_resp.json()
    assert moved_data["folder_id"] == fld_id, f"Move folder_id mismatch: {moved_data}"
    assert moved_data["path"] == "chapters/appendix.tex", f"Expected path 'chapters/appendix.tex', got {moved_data['path']}"
    print(f"✓ Moved 'appendix.tex' into folder 'chapters': new path = {moved_data['path']}")

    # 8. Move document back to root
    move_back_resp = request("POST", f"/documents/{doc_id}/latex/move", {
        "entity_id": root_doc_id,
        "entity_type": "doc",
        "target_folder_id": None
    }, token=token)
    assert move_back_resp.status_code == 200, f"Move doc to root failed: {move_back_resp.text}"
    moved_back_data = move_back_resp.json()
    assert moved_back_data["folder_id"] is None
    assert moved_back_data["path"] == "appendix.tex"
    print(f"✓ Moved 'appendix.tex' back to root: new path = {moved_back_data['path']}")

    # 9. Upload binary file asset directly into folder
    sample_b64 = base64.b64encode(b"fake png image data").decode("utf-8")
    upload_resp = request("POST", f"/documents/{doc_id}/latex/upload", {
        "name": "diagram.png",
        "folder_id": fld_id,
        "data_base64": sample_b64,
        "mime_type": "image/png"
    }, token=token)
    assert upload_resp.status_code in (200, 201), f"Upload file to folder failed: {upload_resp.text}"
    up_file = upload_resp.json()
    file_id = up_file["id"]
    assert "chapters/diagram.png" in up_file.get("path", "")
    print(f"✓ Uploaded file 'diagram.png' into folder 'chapters': path = {up_file['path']}")

    # 10. Move binary file asset to root
    move_file_resp = request("POST", f"/documents/{doc_id}/latex/move", {
        "entity_id": file_id,
        "entity_type": "file",
        "target_folder_id": None
    }, token=token)
    assert move_file_resp.status_code == 200, f"Move file to root failed: {move_file_resp.text}"
    assert move_file_resp.json()["folder_id"] is None
    assert move_file_resp.json()["path"] == "diagram.png"
    print(f"✓ Moved binary asset 'diagram.png' to root")

    # 11. Move binary file asset back to folder
    move_file_fld_resp = request("POST", f"/documents/{doc_id}/latex/move", {
        "entity_id": file_id,
        "entity_type": "file",
        "target_folder_id": fld_id
    }, token=token)
    assert move_file_fld_resp.status_code == 200
    assert move_file_fld_resp.json()["folder_id"] == fld_id
    print(f"✓ Moved binary asset back into folder 'chapters'")

    # 12. Rename folder
    rename_fld_resp = request("POST", f"/documents/{doc_id}/latex/rename", {
        "entity_id": fld_id,
        "entity_type": "folder",
        "new_name": "sections"
    }, token=token)
    assert rename_fld_resp.status_code == 200, f"Rename folder failed: {rename_fld_resp.text}"
    print(f"✓ Renamed folder from 'chapters' to 'sections'")

    # 13. Verify workspace state
    ws2_resp = request("GET", f"/documents/{doc_id}/latex", token=token)
    assert ws2_resp.status_code == 200
    ws2 = ws2_resp.json()
    ch1 = next((d for d in ws2["docs"] if d["name"] == "ch1.tex"), None)
    assert ch1 is not None and ch1["folder_id"] == fld_id
    assert ch1["path"] == "sections/ch1.tex", f"Expected sections/ch1.tex, got {ch1['path']}"
    print(f"✓ Verified child doc updated path after folder rename: {ch1['path']}")

    # 14. Delete folder and check cascade
    del_fld_resp = request("DELETE", f"/documents/{doc_id}/latex/folder/{fld_id}", token=token)
    assert del_fld_resp.status_code == 200, f"Delete folder failed: {del_fld_resp.text}"
    print(f"✓ Deleted folder 'sections'")

    ws3_resp = request("GET", f"/documents/{doc_id}/latex", token=token)
    ws3 = ws3_resp.json()
    assert not any(f["id"] == fld_id for f in ws3["folders"])
    assert not any(d["name"] == "ch1.tex" for d in ws3["docs"])
    assert not any(f["name"] == "diagram.png" for f in ws3["files"])
    print(f"✓ Verified cascade deletion of folder contents")

    # Cleanup test document
    request("DELETE", f"/documents/{doc_id}", token=token)
    print("✓ Cleaned up test document")

    print("\nALL LATEX MOVE & FOLDER FILE MANAGEMENT TESTS PASSED SUCCESSFULLY! 🎉")

if __name__ == "__main__":
    run()
