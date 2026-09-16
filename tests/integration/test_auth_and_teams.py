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

    print("\n--- 5. Test User Type Enforcement on Team Creation ---")
    # Regular user tries to create a team -> Expect 403
    r = requests.post(f"{BASE_URL}/teams", json={
        "name": "Unauthorized Team",
        "description": "Should fail"
    }, headers={"Authorization": f"Bearer {reg_token}"})
    print(f"Regular user team creation status: {r.status_code} (Expected 403)")
    assert r.status_code == 403, f"Regular user was unexpectedly allowed to create a team: {r.text}"

    # Organizer creates a team -> Expect 201
    r = requests.post(f"{BASE_URL}/teams", json={
        "name": "DevOps & Cloud Team",
        "description": "Team for cloud infrastructure and deployments"
    }, headers={"Authorization": f"Bearer {org_token}"})
    assert r.status_code == 201, f"Organizer team creation failed: {r.text}"
    new_team = r.json()
    team_id = new_team["id"]
    join_code = new_team["join_code"]
    print(f"Organizer created team: '{new_team['name']}' (ID: {team_id}, Join Code: {join_code})")
    assert join_code.startswith("TEAM-")

    print("\n--- 6. Test Join Token / Invite Code Flow ---")
    # Regular user joins the team using the join_code
    r = requests.post(f"{BASE_URL}/teams/join", json={
        "join_code": join_code
    }, headers={"Authorization": f"Bearer {reg_token}"})
    assert r.status_code == 200, f"Failed to join team via join code: {r.text}"
    print(f"Regular user successfully joined team: {r.json()['message']}")

    # Check team members
    r = requests.get(f"{BASE_URL}/teams/{team_id}", headers={"Authorization": f"Bearer {org_token}"})
    assert r.status_code == 200
    team_details = r.json()["team"]
    members = team_details["members"]
    print(f"Team '{new_team['name']}' now has {len(members)} members:")
    for m in members:
        print(f" - {m['name']} (@{m['username']}): Role = {m['role']}")
    assert len(members) >= 2

    print("\n--- 7. Test Account Page User Type Role Switching ---")
    # Register a new regular user 'new_member'
    r = requests.post(f"{BASE_URL}/auth/register", json={
        "username": "tester_switch",
        "email": "tester_switch@example.com",
        "password": "Password123!",
        "name": "Role Switch Tester",
        "user_type": "regular"
    })
    assert r.status_code == 201
    switch_user_token = r.json()["token"]

    # Verify cannot create team
    r = requests.post(f"{BASE_URL}/teams", json={"name": "Switch Team"}, headers={"Authorization": f"Bearer {switch_user_token}"})
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

    # Now verify user CAN create team!
    r = requests.post(f"{BASE_URL}/teams", json={"name": "Promoted User Team"}, headers={"Authorization": f"Bearer {switch_user_token}"})
    assert r.status_code == 201, f"Failed to create team after promotion: {r.text}"
    print("Promoted user successfully created a team!")

    print("\n--- 8. Test Template Permissions & Tag/Visibility Search ---")
    # Regular member (role = member) tries to create private template for DevOps team -> Expect 403
    r = requests.post(f"{BASE_URL}/templates", json={
        "title": "Unauthorized Private Template",
        "team_id": team_id,
        "visibility": "private",
        "document_elements": [{"id": "s1", "label": "Section 1", "field_type": "markdown"}]
    }, headers={"Authorization": f"Bearer {reg_token}"})
    print(f"Regular member template create status: {r.status_code} (Expected 403)")
    assert r.status_code == 403

    # Team Manager (organizer) creates private template with tags and description -> Expect 201
    r = requests.post(f"{BASE_URL}/templates", json={
        "title": "Cloud Run Deployment Architecture Blueprint",
        "description": "Standard specification for containerized microservices on Cloud Run.",
        "category": "Architecture",
        "icon": "layers",
        "visibility": "private",
        "team_id": team_id,
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

    # Regular team member lists templates -> Can see the private template for their team + public templates
    r = requests.get(f"{BASE_URL}/templates", headers={"Authorization": f"Bearer {reg_token}"})
    assert r.status_code == 200
    all_tpls = r.json()
    found_private = any(t["id"] == private_tpl["id"] for t in all_tpls)
    print(f"Regular team member can view team's private template: {found_private}")
    assert found_private

    # Search template by tag
    r = requests.get(f"{BASE_URL}/templates?tag=docker", headers={"Authorization": f"Bearer {reg_token}"})
    assert r.status_code == 200
    docker_tpls = r.json()
    assert len(docker_tpls) > 0
    assert any(t["id"] == private_tpl["id"] for t in docker_tpls)
    print(f"Template tag search for 'docker' successfully returned {len(docker_tpls)} template(s)!")

    print("\n--- 9. Test Projects & Co-Authoring Documents ---")
    # Fetch team projects (default project was auto-created)
    r = requests.get(f"{BASE_URL}/projects?team_id={team_id}", headers={"Authorization": f"Bearer {reg_token}"})
    assert r.status_code == 200
    team_projects = r.json()
    assert len(team_projects) > 0
    project_id = team_projects[0]["id"]
    print(f"Using Team Project: '{team_projects[0]['name']}' (ID: {project_id})")

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
