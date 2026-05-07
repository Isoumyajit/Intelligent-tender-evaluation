# ITE Backend — Intelligent Tender Evaluation

## How to Run

Make sure you have Python 3.11 or later and Docker Desktop installed and running on your machine.

Open a PowerShell terminal in the project root (`ite-backend`) and run the setup script. This will build a Docker image, start a PostgreSQL container on port 5432, create all the database tables, and seed initial data. You should see a "PostgreSQL is UP and connectable!" message when it's done.

```powershell
.\scripts\setup-db.ps1
```

Create a Python virtual environment and activate it, then install all dependencies.

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If you want to use the LLM features (criteria extraction, document classification, evidence evaluation), you need a Sarvam AI API key. Open the `.env` file in the project root and set your key. The database URL is already configured with defaults that match the Docker setup, so you don't need to change that.

```env
SARVAM_API_KEY=your_sarvam_api_key_here
```

Start the server. The API will be available at http://localhost:8000.

```powershell
uvicorn app.main:app --reload
```

Open http://localhost:8000/docs in your browser to see the Swagger UI with all available endpoints, or verify the database connection at http://localhost:8000/health.

To test the API, import the `ITE-API.postman_collection.json` file from the project root into Postman. It has all endpoints pre-configured with sample request bodies and variables. Use this collection for all backend testing.

When you are done and want to clean up, run the teardown script to stop and remove the Docker container and image.

```powershell
.\scripts\teardown-db.ps1
```
