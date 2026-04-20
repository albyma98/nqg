import sqlite3
from pathlib import Path

db_path = Path(__file__).resolve().parent.parent / "dev.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.executescript(
    """
    PRAGMA foreign_keys = OFF;

    DROP TABLE IF EXISTS SessionEvent;
    DROP TABLE IF EXISTS Session;
    DROP TABLE IF EXISTS AmbientLine;
    DROP TABLE IF EXISTS Transit;
    DROP TABLE IF EXISTS Checkpoint;
    DROP TABLE IF EXISTS Mission;
    DROP TABLE IF EXISTS Place;
    DROP TABLE IF EXISTS Tone;
    DROP TABLE IF EXISTS City;
    DROP TABLE IF EXISTS AdminUser;
    DROP TABLE IF EXISTS PlaceFacts;
    DROP TABLE IF EXISTS GeneratedMissionProposal;
    DROP TABLE IF EXISTS GenerationRule;
    DROP TABLE IF EXISTS SystemPromptVersion;

    CREATE TABLE City (
      id TEXT PRIMARY KEY NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT 0,
      openingLine TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE Place (
      id TEXT PRIMARY KEY NOT NULL,
      cityId TEXT NOT NULL,
      name TEXT NOT NULL,
      zone TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      gpsRadius INTEGER NOT NULL DEFAULT 30,
      gpsUncertaintyRadius INTEGER NOT NULL DEFAULT 50,
      fallbackAllowed BOOLEAN NOT NULL DEFAULT 1,
      approachHintRadius INTEGER NOT NULL DEFAULT 150,
      atmosphere TEXT NOT NULL,
      hint TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT 1
    );

    CREATE TABLE PlaceFacts (
      id TEXT PRIMARY KEY NOT NULL,
      placeId TEXT NOT NULL UNIQUE,
      visualElements TEXT NOT NULL,
      sensoryElements TEXT NOT NULL,
      historicalFacts TEXT NOT NULL,
      notableDetails TEXT NOT NULL,
      confirmedBy TEXT NOT NULL,
      confirmedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      adminNotes TEXT
    );

    CREATE TABLE Tone (
      id TEXT PRIMARY KEY NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      guidelines TEXT NOT NULL,
      bannedWords TEXT NOT NULL,
      examples TEXT NOT NULL
    );

    CREATE TABLE Mission (
      id TEXT PRIMARY KEY NOT NULL,
      cityId TEXT NOT NULL,
      placeId TEXT NOT NULL,
      title TEXT NOT NULL,
      toneSlug TEXT NOT NULL,
      difficulty INTEGER NOT NULL,
      objective TEXT NOT NULL,
      openingBrief TEXT NOT NULL,
      successNote TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      active BOOLEAN NOT NULL DEFAULT 1,
      tags TEXT NOT NULL
    );

    CREATE TABLE Transit (
      id TEXT PRIMARY KEY NOT NULL,
      missionId TEXT NOT NULL UNIQUE,
      estimatedMinutes INTEGER NOT NULL,
      recommendedPath TEXT
    );

    CREATE TABLE AmbientLine (
      id TEXT PRIMARY KEY NOT NULL,
      transitId TEXT NOT NULL,
      trigger TEXT NOT NULL,
      text TEXT NOT NULL,
      tone TEXT,
      "order" INTEGER NOT NULL,
      minSecondsFromPrevious INTEGER NOT NULL DEFAULT 60
    );

    CREATE TABLE Checkpoint (
      id TEXT PRIMARY KEY NOT NULL,
      missionId TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      validationRule TEXT NOT NULL,
      hints TEXT NOT NULL,
      acceptAny BOOLEAN NOT NULL DEFAULT 0
    );

    CREATE TABLE Session (
      id TEXT PRIMARY KEY NOT NULL,
      cityId TEXT NOT NULL,
      alias TEXT NOT NULL,
      startedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finishedAt DATETIME,
      currentMissionId TEXT,
      currentCheckpointId TEXT,
      lastGeoUpdate DATETIME,
      lastKnownLatitude REAL,
      lastKnownLongitude REAL,
      lastKnownAccuracy REAL,
      geoState TEXT NOT NULL DEFAULT 'unknown',
      elapsedSeconds INTEGER NOT NULL DEFAULT 0,
      pauseEvents TEXT NOT NULL DEFAULT '[]',
      transitPath TEXT NOT NULL DEFAULT '[]',
      lastAmbientLineAt DATETIME,
      lastAmbientTrigger TEXT,
      batteryLevelAtStart REAL,
      batteryLevelCurrent REAL,
      compassPermissionGranted BOOLEAN NOT NULL DEFAULT 0,
      geoPermissionGranted BOOLEAN NOT NULL DEFAULT 0,
      narrativeState TEXT NOT NULL,
      completedMissionIds TEXT NOT NULL
    );

    CREATE TABLE SessionEvent (
      id TEXT PRIMARY KEY NOT NULL,
      sessionId TEXT NOT NULL,
      timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      type TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE AdminUser (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor',
      active BOOLEAN NOT NULL DEFAULT 1,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE GenerationRule (
      id TEXT PRIMARY KEY NOT NULL,
      targetType TEXT NOT NULL,
      vincoli TEXT NOT NULL,
      examplesPositive TEXT NOT NULL,
      examplesNegative TEXT NOT NULL,
      validationChecklist TEXT NOT NULL
    );

    CREATE TABLE GeneratedMissionProposal (
      id TEXT PRIMARY KEY NOT NULL,
      batchId TEXT NOT NULL,
      cityId TEXT NOT NULL,
      status TEXT NOT NULL,
      reviewedBy TEXT,
      reviewedAt DATETIME,
      proposedMission TEXT NOT NULL,
      proposedCheckpoints TEXT NOT NULL,
      proposedTransit TEXT,
      generationConfig TEXT NOT NULL,
      generationModel TEXT NOT NULL,
      generationCost REAL,
      generatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      approvedAsMissionId TEXT UNIQUE,
      modifications TEXT,
      rejectionReason TEXT
    );

    CREATE TABLE SystemPromptVersion (
      id TEXT PRIMARY KEY NOT NULL,
      content TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """
)

conn.commit()
conn.close()
print(f"SQLite schema creato in {db_path}")
