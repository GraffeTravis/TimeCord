CREATE TABLE clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0);
CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, clientId TEXT REFERENCES clients(id), archived INTEGER NOT NULL DEFAULT 0);
CREATE TABLE entries (id TEXT PRIMARY KEY, description TEXT NOT NULL, projectId TEXT NOT NULL REFERENCES projects(id), clientId TEXT REFERENCES clients(id), start TEXT NOT NULL, end TEXT NOT NULL, CHECK(end > start));
CREATE INDEX entries_dates ON entries(start,end);
CREATE INDEX entries_project ON entries(projectId);
CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id=1), timezone TEXT NOT NULL, weeklyGoal REAL NOT NULL);
INSERT INTO settings VALUES (1,'Pacific/Tahiti',35);
CREATE TABLE timer (id INTEGER PRIMARY KEY CHECK(id=1), description TEXT NOT NULL, projectId TEXT NOT NULL REFERENCES projects(id), clientId TEXT REFERENCES clients(id), start TEXT NOT NULL);
PRAGMA user_version=1;
