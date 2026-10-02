import requests
import sys

BASE_URL = "http://localhost:5000/api/v1"

def test_full_system_flow():
    print("\n--- 1. Health Check ---")
    r = requests.get(f"{BASE_URL}/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    health = r.json()
    print("Health:", health)
    assert health["status"] == "ok"
    assert health["database"] == "connected"

    print("\n--- 2. Public Demo Users List ---")
    r = requests.get(f"{BASE_URL}/auth/demo-users")
    assert r.status_code == 200
    demo_users = r.json()
    print(f"Found {len(demo_users)} demo users in config:")
    for du in demo_users:
        print(f" - {du['name']} (@{du['username']}): {du['user_type']}")
    assert len(demo_users) >= 2

    print("\n--- 3. Login as Demo Organizer ---")
    r = requests.post(f"{BASE_URL}/auth/login", json={
        "usernameOrEmail": "demo_organizer",
        "password": "Password123!"
    })
    assert r.status_code == 200, f"Login failed: {r.text}"
    org_auth = r.json()
    org_token = org_auth["token"]
    org_user = org_auth["user"]
    print(f"Logged in as: {org_user['name']} ({org_user['user_type']})")
    assert org_user["user_type"] == "organizer"

    print("\n--- 4. Login as Demo Regular User ---")
    r = requests.post(f"{BASE_URL}/auth/login", json={
        "usernameOrEmail": "demo_regular",
        "password": "Password123!"
    })
    assert r.status_code == 200, f"Login failed: {r.text}"
    reg_auth = r.json()
    reg_token = reg_auth["token"]
    reg_user = reg_auth["user"]
    print(f"Logged in as: {reg_user['name']} ({reg_user['user_type']})")
    assert reg_user["user_type"] == "regular"

    print("\n--- 5. Test User Type Enforcement on Organization Creation ---")
    # Regular user tries to create an organization -> Expect 403
    r = requests.post(f"{BASE_URL}/organizations", json={
        "name": "Unauthorized Organization",
        "description": "Should fail"
    }, headers={"Authorization": f"Bearer {reg_token}"})
    print(f"Regular user org creation status: {r.status_code} (Expected 403)")
    assert r.status_code == 403, f"Regular user was unexpectedly allowed to create an organization: {r.text}"

    # Also verify backward-compatible /teams route enforces 403 for regular user
    r_teams_compat = requests.post(f"{BASE_URL}/teams", json={
        "name": "Unauthorized Team Alias",
        "description": "Should fail"
    }, headers={"Authorization": f"Bearer {reg_token}"})
    assert r_teams_compat.status_code == 403

    # Organizer creates an organization -> Expect 201
    r = requests.post(f"{BASE_URL}/organizations", json={
        "name": "DevOps & Cloud Organization",
        "description": "Organization for cloud infrastructure and deployments"
    }, headers={"Authorization": f"Bearer {org_token}"})
    assert r.status_code == 201, f"Organizer organization creation failed: {r.text}"
    new_org = r.json()
    org_id = new_org["id"]
    join_code = new_org["join_code"]
    print(f"Organizer created organization: '{new_org['name']}' (ID: {org_id}, Join Code: {join_code})")
    assert join_code.startswith("ORG-")

    # Organizer also creates an organization via backward-compatible /teams route -> Expect 201
    r_team_create = requests.post(f"{BASE_URL}/teams", json={
        "name": "Platform Infrastructure Team",
        "description": "Testing backward compatibility /teams route"
    }, headers={"Authorization": f"Bearer {org_token}"})
    assert r_team_create.status_code == 201
    print("Backward-compatible /teams endpoint successfully created an organization!")

    print("\n--- 6. Test Join Token / Invite Code Flow ---")
    # Regular user joins the organization using the join_code
    r = requests.post(f"{BASE_URL}/organizations/join", json={
        "join_code": join_code
    }, headers={"Authorization": f"Bearer {reg_token}"})
    assert r.status_code == 200, f"Failed to join organization via join code: {r.text}"
    print(f"Regular user successfully joined organization: {r.json()['message']}")

    # Check organization details and members
    r = requests.get(f"{BASE_URL}/organizations/{org_id}", headers={"Authorization": f"Bearer {org_token}"})
    assert r.status_code == 200
    org_details = r.json()["organization"]
    members = org_details["members"]
    print(f"Organization '{new_org['name']}' now has {len(members)} members:")
    for m in members:
        print(f" - {m['name']} (@{m['username']}): Role = {m['role']}")
    assert len(members) >= 2

    # Check backward-compatible /teams/{id} retrieval
    r_team_get = requests.get(f"{BASE_URL}/teams/{org_id}", headers={"Authorization": f"Bearer {org_token}"})
    assert r_team_get.status_code == 200
    assert "organization" in r_team_get.json() or "team" in r_team_get.json()

    print("\n--- 7. Test Account Registration, 30-Second Verification Token & Resend ---")
    import time
    test_uid = int(time.time())
    test_username = f"tester_{test_uid}"
    test_email = f"tester_{test_uid}@example.com"

    # 7.1 Register a new regular user -> Receives verification token
    r = requests.post(f"{BASE_URL}/auth/register", json={
        "username": test_username,
        "email": test_email,
        "password": "Password123!",
        "name": "Role Switch Tester",
        "user_type": "regular"
    })
    assert r.status_code == 201, f"Registration failed: {r.text}"
    reg_data = r.json()
    assert reg_data["requires_verification"] is True
    assert reg_data["expires_in_seconds"] == 30
    assert "verification_token" in reg_data
    assert "token" not in reg_data or reg_data.get("token") is None
    verification_code = reg_data["verification_token"]
    user_id = reg_data["user_id"]
    print(f"User registered. Received 30s verification token: {verification_code}")

    # 7.2 Unverified user attempts login -> Rejection with 403 requires_verification
    r = requests.post(f"{BASE_URL}/auth/login", json={
        "usernameOrEmail": test_username,
        "password": "Password123!"
    })
    assert r.status_code == 403, f"Expected 403 for unverified user: {r.text}"
    login_err = r.json()
    assert login_err["requires_verification"] is True
    print("Unverified user login correctly rejected with 403 and requires_verification.")

    # 7.3 Try verifying with incorrect code -> Expect 400
    r = requests.post(f"{BASE_URL}/auth/verify", json={
        "userId": user_id,
        "token": "000000"
    })
    assert r.status_code == 400, f"Expected 400 for bad code: {r.text}"
    print("Invalid verification code correctly rejected.")

    # 7.4 Test resend verification token
    r = requests.post(f"{BASE_URL}/auth/resend-verification", json={
        "userId": user_id
    })
    assert r.status_code == 200, f"Resend failed: {r.text}"
    resend_data = r.json()
    assert resend_data["expires_in_seconds"] == 30
    new_verification_code = resend_data["verification_token"]
    print(f"Resent fresh verification code: {new_verification_code}")

    # 7.5 Verify account with fresh token
    r = requests.post(f"{BASE_URL}/auth/verify", json={
        "userId": user_id,
        "token": new_verification_code
    })
    assert r.status_code == 200, f"Account verification failed: {r.text}"
    verify_data = r.json()
    switch_user_token = verify_data["token"]
    assert verify_data["user"]["is_verified"] is True
    print("Account verified successfully with token! Auth token issued.")

    # 7.6 Subsequent login now succeeds
    r = requests.post(f"{BASE_URL}/auth/login", json={
        "usernameOrEmail": test_username,
        "password": "Password123!"
    })
    assert r.status_code == 200, f"Login failed for verified user: {r.text}"
    print("Verified user can now log in normally.")

    print("\n--- 7.7 Test Account Page User Type Role Switching ---")

    # Verify cannot create organization
    r = requests.post(f"{BASE_URL}/organizations", json={"name": "Switch Org"}, headers={"Authorization": f"Bearer {switch_user_token}"})
    assert r.status_code == 403

    # Switch user type to 'organizer' via profile update
    r = requests.put(f"{BASE_URL}/auth/profile", json={
        "name": "Role Switch Tester (Promoted)",
        "user_type": "organizer"
    }, headers={"Authorization": f"Bearer {switch_user_token}"})
    assert r.status_code == 200
    switch_user_token = r.json()["token"] # update token
    assert r.json()["user"]["user_type"] == "organizer"
    print(f"User switched user_type to 'organizer' via Account profile update!")

    # Now verify user CAN create organization!
    r = requests.post(f"{BASE_URL}/organizations", json={"name": "Promoted User Organization"}, headers={"Authorization": f"Bearer {switch_user_token}"})
    assert r.status_code == 201, f"Failed to create organization after promotion: {r.text}"
    print("Promoted user successfully created an organization!")

    print("\n--- 8. Test Template Permissions & Tag/Visibility Search ---")
    # Regular member (role = member) tries to create private template for DevOps organization -> Expect 403
    r = requests.post(f"{BASE_URL}/templates", json={
        "title": "Unauthorized Private Template",
        "organization_id": org_id,
        "visibility": "private",
        "document_elements": [{"id": "s1", "label": "Section 1", "field_type": "markdown"}]
    }, headers={"Authorization": f"Bearer {reg_token}"})
    print(f"Regular member template create status: {r.status_code} (Expected 403)")
    assert r.status_code == 403

    # Organization Manager (organizer) creates private template with tags and description -> Expect 201
    r = requests.post(f"{BASE_URL}/templates", json={
        "title": "Cloud Run Deployment Architecture Blueprint",
        "description": "Standard specification for containerized microservices on Cloud Run.",
        "category": "Architecture",
        "icon": "layers",
        "visibility": "private",
        "organization_id": org_id,
        "tags": ["cloud", "docker", "serverless", "deployment"],
        "document_elements": [
            {
                "id": "overview",
                "label": "1. Deployment Overview",
                "field_type": "markdown",
                "default_value": "### Target Service\n- Service Name:\n- Scaling Limits:"
            },
            {
                "id": "env_vars",
                "label": "2. Environment Variables",
                "field_type": "markdown",
                "default_value": "Key variables and secret configs"
            }
        ]
    }, headers={"Authorization": f"Bearer {org_token}"})
    assert r.status_code == 201, f"Failed to create private template: {r.text}"
    private_tpl = r.json()
    print(f"Manager created private template: '{private_tpl['title']}' (Tags: {private_tpl['tags']})")

    # Regular organization member lists templates -> Can see the private template for their organization + public templates
    r = requests.get(f"{BASE_URL}/templates", headers={"Authorization": f"Bearer {reg_token}"})
    assert r.status_code == 200
    all_tpls = r.json()
    found_private = any(t["id"] == private_tpl["id"] for t in all_tpls)
    print(f"Regular member can view organization's private template: {found_private}")
    assert found_private

    # Search template by tag
    r = requests.get(f"{BASE_URL}/templates?tag=docker", headers={"Authorization": f"Bearer {reg_token}"})
    assert r.status_code == 200
    docker_tpls = r.json()
    assert len(docker_tpls) > 0
    assert any(t["id"] == private_tpl["id"] for t in docker_tpls)
    print(f"Template tag search for 'docker' successfully returned {len(docker_tpls)} template(s)!")

    print("\n--- 9. Test Projects & Co-Authoring Documents ---")
    # Fetch organization projects (default project was auto-created)
    r = requests.get(f"{BASE_URL}/projects?organization_id={org_id}", headers={"Authorization": f"Bearer {reg_token}"})
    assert r.status_code == 200
    org_projects = r.json()
    assert len(org_projects) > 0
    project_id = org_projects[0]["id"]
    print(f"Using Organization Project: '{org_projects[0]['name']}' (ID: {project_id})")

    # Also verify backward-compatible query ?team_id= works
    r_team_proj = requests.get(f"{BASE_URL}/projects?team_id={org_id}", headers={"Authorization": f"Bearer {reg_token}"})
    assert r_team_proj.status_code == 200
    assert len(r_team_proj.json()) > 0

    # Regular user creates document in the project using private template
    r = requests.post(f"{BASE_URL}/documents", json={
        "title": "Auth Service Deployment Spec",
        "template_id": private_tpl["id"],
        "project_id": project_id,
        "tags": ["auth", "security", "production"],
        "elements_data": {
            "overview": "### Target Service\n- Service Name: `auth-service`\n- Scaling Limits: min 2, max 10",
            "env_vars": "PORT=5000\nJWT_SECRET=supersecret"
        }
    }, headers={"Authorization": f"Bearer {reg_token}"})
    assert r.status_code == 201, f"Failed to create document: {r.text}"
    doc = r.json()
    doc_id = doc["id"]
    print(f"Regular user created document: '{doc['title']}' (ID: {doc_id})")
    assert doc["created_by"] == reg_user["id"]
    assert doc["last_edited_by"] == reg_user["id"]

    # Organizer (collaborator) co-edits the document
    r = requests.put(f"{BASE_URL}/documents/{doc_id}", json={
        "title": "Auth Service Deployment Spec (v1.1 Review)",
        "status": "in_review",
        "elements_data": {
            "overview": "### Target Service\n- Service Name: `auth-service`\n- Scaling Limits: min 3, max 20 (reviewed)",
            "env_vars": "PORT=5000\nJWT_SECRET=supersecret\nDB_POOL=25"
        }
    }, headers={"Authorization": f"Bearer {org_token}"})
    assert r.status_code == 200, f"Failed to co-edit document: {r.text}"
    updated_doc = r.json()
    print(f"Organizer co-edited document. New status: {updated_doc['status']}")
    assert updated_doc["created_by"] == reg_user["id"]
    assert updated_doc["last_edited_by"] == org_user["id"]
    assert "DB_POOL=25" in updated_doc["compiled_markdown"]

    print("\n=======================================================")
    print(" ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ")
    print("=======================================================\n")

if __name__ == "__main__":
    test_full_system_flow()
