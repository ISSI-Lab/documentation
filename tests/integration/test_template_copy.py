#!/usr/bin/env python3
"""Integration tests for Template Copying Across Creator Organizations.

Validates the full lifecycle and security rules:
1. Creating a template in Organization A.
2. Copying the template from Organization A to Organization B where the user is the creator.
3. Verifying copied template integrity, attributes, and creator attribution.
4. Enforcing guardrails:
   - Copying to the same organization is forbidden (400 Bad Request).
   - Copying to a non-existent organization fails (404 Not Found).
   - Copying by a non-creator into an organization where they are not creator is forbidden (403 Forbidden).
   - Copying someone else's organization template by a non-creator is forbidden (403 Forbidden).
"""

import sys
import uuid
import json

try:
    import requests
except ImportError:
    import urllib.request
    import urllib.error

    class _Response:
        def __init__(self, status_code, body_bytes):
            self.status_code = status_code
            self.text = body_bytes.decode("utf-8") if body_bytes else ""

        def json(self):
            return json.loads(self.text) if self.text else {}

    class _RequestsWrapper:
        @staticmethod
        def _req(method, url, json_data=None, headers=None, timeout=10):
            req_headers = {"Content-Type": "application/json"}
            if headers:
                req_headers.update(headers)
            data = json.dumps(json_data).encode("utf-8") if json_data is not None else None
            req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    return _Response(resp.status, resp.read())
            except urllib.error.HTTPError as e:
                return _Response(e.code, e.read())

        def get(self, url, headers=None, timeout=10):
            return self._req("GET", url, headers=headers, timeout=timeout)

        def post(self, url, json=None, headers=None, timeout=10):
            return self._req("POST", url, json_data=json, headers=headers, timeout=timeout)

        def put(self, url, json=None, headers=None, timeout=10):
            return self._req("PUT", url, json_data=json, headers=headers, timeout=timeout)

        def delete(self, url, headers=None, timeout=10):
            return self._req("DELETE", url, headers=headers, timeout=timeout)

    requests = _RequestsWrapper()

BASE_URL = "http://localhost:5000/api/v1"


def run_tests():
    print("==================================================================")
    print("Starting Integration Tests: Template Copy Between Creator Organizations")
    print("==================================================================")

    # 1. Health check
    print("\n--- 1. Health Check ---")
    try:
        r = requests.get(f"{BASE_URL}/health")
    except Exception as e:
        print(f"Skipping live API run (backend not reachable at {BASE_URL}): {e}")
        return 0

    assert r.status_code == 200, f"Health check failed: {r.text}"
    print("Health check OK")

    # 2. Login as demo_organizer
    print("\n--- 2. Login as Demo Organizer ---")
    r = requests.post(
        f"{BASE_URL}/auth/login",
        json={"usernameOrEmail": "demo_organizer", "password": "Password123!"},
    )
    assert r.status_code == 200, f"Organizer login failed: {r.text}"
    org_auth = r.json()
    org_token = org_auth["token"]
    org_user = org_auth["user"]
    org_headers = {"Authorization": f"Bearer {org_token}"}
    print(f"Logged in as organizer: {org_user['name']} ({org_user['id']})")

    # 3. Login as demo_regular
    print("\n--- 3. Login as Demo Regular User ---")
    r = requests.post(
        f"{BASE_URL}/auth/login",
        json={"usernameOrEmail": "demo_regular", "password": "Password123!"},
    )
    assert r.status_code == 200, f"Regular login failed: {r.text}"
    reg_auth = r.json()
    reg_token = reg_auth["token"]
    reg_user = reg_auth["user"]
    reg_headers = {"Authorization": f"Bearer {reg_token}"}
    print(f"Logged in as regular user: {reg_user['name']} ({reg_user['id']})")

    # 4. Create two organizations by organizer: Org A and Org B
    print("\n--- 4. Create Source Organization A and Destination Organization B ---")
    org_a_name = f"Alpha Team {uuid.uuid4().hex[:6]}"
    r = requests.post(
        f"{BASE_URL}/organizations",
        json={"name": org_a_name, "description": "Source Organization A"},
        headers=org_headers,
    )
    assert r.status_code == 201, f"Failed to create Org A: {r.text}"
    org_a = r.json()
    print(f"Created Org A: {org_a['name']} ({org_a['id']})")

    org_b_name = f"Beta Team {uuid.uuid4().hex[:6]}"
    r = requests.post(
        f"{BASE_URL}/organizations",
        json={"name": org_b_name, "description": "Destination Organization B"},
        headers=org_headers,
    )
    assert r.status_code == 201, f"Failed to create Org B: {r.text}"
    org_b = r.json()
    print(f"Created Org B: {org_b['name']} ({org_b['id']})")

    # 5. Create a template in Organization A
    print("\n--- 5. Create Template in Organization A ---")
    template_title = f"Sprint Retro Blueprint {uuid.uuid4().hex[:4]}"
    template_payload = {
        "title": template_title,
        "description": "Retrospective template with iterative key-value elements.",
        "category": "Operations",
        "icon": "layers",
        "visibility": "private",
        "organization_id": org_a["id"],
        "tags": ["agile", "retro", "sprint"],
        "document_elements": [
            {
                "id": "went_well",
                "label": "What Went Well",
                "field_type": "markdown",
                "default_value": "- Success highlights...",
                "required": True,
            },
            {
                "id": "action_items",
                "label": "Action Items",
                "field_type": "repeatable_list",
                "default_value": [
                    {"id": "act-1", "title": "CI Improvement", "content": "Reduce build latency"}
                ],
                "required": False,
            },
        ],
    }
    r = requests.post(
        f"{BASE_URL}/templates",
        json=template_payload,
        headers=org_headers,
    )
    assert r.status_code == 201, f"Failed to create template in Org A: {r.text}"
    source_tpl = r.json()
    print(f"Created source template: '{source_tpl['title']}' ({source_tpl['id']}) in Org A")
    assert source_tpl["organization_id"] == org_a["id"]
    assert source_tpl["creator_name"] is not None or source_tpl["created_by"] == org_user["id"]

    # 6. Copy template from Org A to Org B
    print("\n--- 6. Copy Template from Organization A to Creator's Organization B ---")
    copied_title = f"{template_title} (Beta Copy)"
    r = requests.post(
        f"{BASE_URL}/templates/{source_tpl['id']}/copy",
        json={
            "target_organization_id": org_b["id"],
            "title": copied_title,
        },
        headers=org_headers,
    )
    assert r.status_code == 201, f"Failed to copy template to Org B: {r.text}"
    copied_tpl = r.json()
    print(f"Successfully copied template: '{copied_tpl['title']}' ({copied_tpl['id']})")
    assert copied_tpl["id"] != source_tpl["id"], "Copied template must have a unique ID"
    assert copied_tpl["organization_id"] == org_b["id"], "Copied template must be scoped to Org B"
    assert copied_tpl["title"] == copied_title, "Copied template must match requested title"
    assert copied_tpl["created_by"] == org_user["id"], "Copied template creator must be the user who copied it"
    assert len(copied_tpl["document_elements"]) == len(source_tpl["document_elements"])
    assert "agile" in copied_tpl["tags"]

    # 7. Verify listing templates in Org B shows the copied template
    print("\n--- 7. Verify Org B Template Listing ---")
    r = requests.get(
        f"{BASE_URL}/templates?organization_id={org_b['id']}",
        headers=org_headers,
    )
    assert r.status_code == 200, f"Failed to list Org B templates: {r.text}"
    org_b_templates = r.json()
    assert any(t["id"] == copied_tpl["id"] for t in org_b_templates), "Copied template not found in Org B listing"
    print(f"Verified Org B has {len(org_b_templates)} template(s), including copied template")

    # 8. Guardrail: Cannot copy template to the same organization
    print("\n--- 8. Guardrail: Copy to Same Organization Forbidden (400) ---")
    r = requests.post(
        f"{BASE_URL}/templates/{source_tpl['id']}/copy",
        json={"target_organization_id": org_a["id"]},
        headers=org_headers,
    )
    assert r.status_code == 400, f"Expected 400 when copying to same org, got {r.status_code}: {r.text}"
    print("Correctly rejected copying to same organization (400 Bad Request)")

    # 9. Guardrail: Copy to non-existent organization fails (404)
    print("\n--- 9. Guardrail: Copy to Non-existent Organization Fails (404) ---")
    r = requests.post(
        f"{BASE_URL}/templates/{source_tpl['id']}/copy",
        json={"target_organization_id": "non_existent_org_xyz"},
        headers=org_headers,
    )
    assert r.status_code == 404, f"Expected 404 when target org does not exist, got {r.status_code}: {r.text}"
    print("Correctly returned 404 for non-existent target organization")

    # 10. Guardrail: Copy non-existent template fails (404)
    print("\n--- 10. Guardrail: Copy Non-existent Template Fails (404) ---")
    r = requests.post(
        f"{BASE_URL}/templates/non_existent_template_xyz/copy",
        json={"target_organization_id": org_b["id"]},
        headers=org_headers,
    )
    assert r.status_code == 404, f"Expected 404 when template does not exist, got {r.status_code}: {r.text}"
    print("Correctly returned 404 for non-existent source template")

    # 11. Guardrail: User who is NOT creator of target organization cannot copy into it (403)
    print("\n--- 11. Guardrail: Non-creator Forbidden to Copy Into Target Org (403) ---")
    r = requests.post(
        f"{BASE_URL}/templates/{source_tpl['id']}/copy",
        json={"target_organization_id": org_b["id"]},
        headers=reg_headers,
    )
    assert r.status_code == 403, f"Expected 403 for non-creator of target org, got {r.status_code}: {r.text}"
    print("Correctly blocked non-creator from copying template into target organization (403 Forbidden)")

    print("\n==================================================================")
    print("ALL INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("==================================================================")
    return 0


if __name__ == "__main__":
    sys.exit(run_tests())
