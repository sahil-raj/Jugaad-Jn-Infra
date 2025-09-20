import { Client } from "@elastic/elasticsearch";
import * as dotenv from "dotenv";

dotenv.config();

// Elasticsearch client with compatibility for version 8
const esClient = new Client({
  node: process.env.ELASTIC_URL || "http://localhost:9200",
  auth: {
    username: process.env.ELASTIC_USERNAME || "elastic",
    password: process.env.ELASTIC_PASSWORD || "changeme",
  },
  headers: {
    "Accept": "application/vnd.elasticsearch+json; compatible-with=8",
  },
});

const USERS = ["alice", "bob", "charlie", "eve"];
const IPS = ["192.168.1.10", "192.168.1.20", "10.0.0.5", "172.16.0.2"];
const HOSTS = ["web-01", "db-01", "vpn-01", "mail-01"];
const PROCESSES = ["sshd", "nginx", "powershell", "chrome", "python3"];
const MALWARE = ["trojan.exe", "worm.js", "cryptominer.sh"];

// Safe random choice
function randomChoice<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error("randomChoice called with empty array");
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// Random timestamp in last 7 days
function randomTimestamp(): string {
  const now = new Date();
  const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime())).toISOString();
}

// Generate a random event
function generateEvent() {
  const eventTypes = ["authentication", "process", "malware"];
  const type = randomChoice(eventTypes);

  let event: any = {
    "@timestamp": randomTimestamp(),
    "host.name": randomChoice(HOSTS),
    "user.name": randomChoice(USERS),
    "source.ip": randomChoice(IPS),
    "event.type": type,
  };

  if (type === "authentication") {
    event["event.action"] = "login";
    event["event.outcome"] = Math.random() > 0.7 ? "failure" : "success";
  } else if (type === "process") {
    event["event.action"] = "start";
    event["process.name"] = randomChoice(PROCESSES);
  } else if (type === "malware") {
    event["event.action"] = "detected";
    event["malware.name"] = randomChoice(MALWARE);
    event["event.severity"] = Math.floor(Math.random() * 5) + 1;
  }

  return event;
}

// Ensure index with mappings
async function ensureIndex() {
  const indexName = "logs-siem";

  const exists = await esClient.indices.exists({ index: indexName });
  if (!exists) {
    console.log(`Creating index: ${indexName}`);
    await esClient.indices.create({
      index: indexName,
      body: {
        mappings: {
          properties: {
            "@timestamp": { type: "date" },
            "host.name": { type: "keyword" },
            "user.name": { type: "keyword" },
            "source.ip": { type: "ip" },
            "destination.ip": { type: "ip" },
            "event.type": { type: "keyword" },
            "event.action": { type: "keyword" },
            "event.outcome": { type: "keyword" },
            "process.name": { type: "keyword" },
            "malware.name": { type: "keyword" },
            "network.protocol": { type: "keyword" },
            "file.hash": { type: "keyword" },
          },
        },
      },
    } as any); // typecast to avoid TS overload errors
  } else {
    console.log(`Index ${indexName} already exists`);
  }
}

// Insert test data
async function loadData(count = 500) {
  await ensureIndex();

  const ops: any[] = [];
  for (let i = 0; i < count; i++) {
    ops.push({ index: { _index: "logs-siem" } });
    ops.push(generateEvent());
  }

  const resp = await esClient.bulk({ body: ops, refresh: true });
  if (resp.errors) {
    console.error("Errors inserting data:", JSON.stringify(resp, null, 2));
  } else {
    console.log(`✅ Inserted ${count} test events into logs-siem`);
  }
}

// Run loader
loadData(500).catch((err) => {
  console.error("Error loading test data:", err);
});

