const { onRequest } = require("firebase-functions/v2/https");
const axios = require("axios");
const qs = require("qs");
const cors = require("cors");

const corsHandler = cors({ origin: true });

// Use environment config instead of hardcoding secrets!
// const IBM_API_KEY = "6Zdjf_EuSukdgjcinncuhe_coEAaJ5nL2z4pCHm6NuQ7";
// const IBM_PROJECT_ID = "cf14ff7c-6d7d-4cdb-b009-670f8020f8f7";

// const IBM_MODEL_ID = "ibm/granite-13b-instruct-v2";
// const REGION = "us-south";

const IBM_API_KEY = "Oj36pukErzi6fFvZJeR6Jpz7v5u7JY-9oZyvDrqE5qkE"; // Keep secret in production
const IBM_PROJECT_ID = "cf14ff7c-6d7d-4cdb-b009-670f8020f8f7";

const IBM_MODEL_ID = "ibm/granite-13b-instruct-v2";
const REGION = "us-south";

// exports.getAccessTokenIBM = onRequest((req, res) => {
//   corsHandler(req, res, async () => {
//     const data = qs.stringify({
//       grant_type: "urn:ibm:params:oauth:grant-type:apikey",
//       apikey: IBM_API_KEY,
//     });

//     try {
//       const response = await axios.post(
//         "https://iam.cloud.ibm.com/identity/token",
//         data,
//         {
//           headers: {
//             "Content-Type": "application/x-www-form-urlencoded",
//           },
//         }
//       );
//       res.status(200).json(response.data);
//     } catch (error) {
//       console.error("Error in proxy:", error.response?.data || error.message);
//       res.status(500).json({ error: "Failed to fetch token" });
//     }
//   });
// });

// ========================
// Auth & Config Helpers
// ========================
function getJiraAuthHeader() {
  const email = process.env.JIRA_EMAIL || "personalbuddycfc@gmail.com";
  const apiToken =
    process.env.JIRA_TOKEN ||
    "ATATT3xFfGF01qNR9GcgDLsHc1Tn2dI6bxQno4XF3Bfa9vgybciR4R2x-M-aftneIXGEhYvZUtd598uiJ-VyGt5Xm0lPsYkYLb2yDfu9meJvcis10cvUeirYDOqDSg6IdGl54qQjx3FfDP8QM_Jr3GLZ88rjcw8rlgVyiGTiE0SLpsRSwhGvPoE=A7697119";
  return "Basic " + Buffer.from(`${email}:${apiToken}`).toString("base64");
}

function getJiraDomain() {
  return process.env.JIRA_DOMAIN || "personalbuddycfc";
}
async function getPrompt(req) {
  return req.query.q || req.body.q || "Summarize (Story, To Do)";
}
function getGraniteConfig() {
  return {
    apiKey:
      process.env.IBM_API_KEY || "Oj36pukErzi6fFvZJeR6Jpz7v5u7JY-9oZyvDrqE5qkE",
    projectId:
      process.env.IBM_PROJECT_ID || "cf14ff7c-6d7d-4cdb-b009-670f8020f8f7",
    modelId: process.env.IBM_MODEL_ID || "ibm/granite-13b-instruct-v2",
  };
}

// ========================
// IBM Granite Auth
// ========================
async function getGraniteAccessToken() {
  const { apiKey } = getGraniteConfig();
  const data = qs.stringify({
    grant_type: "urn:ibm:params:oauth:grant-type:apikey",
    apikey: apiKey,
  });
  const response = await axios.post(
    "https://iam.cloud.ibm.com/identity/token",
    data,
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );
  return response.data.access_token;
}

// ========================
// JIRA Data Fetching
// ========================
async function getLatestRelJiraData() {
  const jiraDomain = getJiraDomain();
  const auth = getJiraAuthHeader();
  const issueType = "Story";
  const jql = `fixVersion ~ "REL*" AND project = SCRUM AND issuetype = ${issueType} AND Sprint in futureSprints()`;

  const response = await axios.get(
    `https://${jiraDomain}.atlassian.net/rest/api/2/search`,
    {
      params: {
        jql,
        fields: "key,summary,status,issuetype,fixVersions,assignee,reporter",
        maxResults: 100,
      },
      headers: {
        Authorization: auth,
        Accept: "application/json",
      },
    }
  );

  const groupedByFixVersion = {};
  for (const issue of response.data.issues) {
    const fixVersions = issue.fields.fixVersions || [];
    if (fixVersions.length === 0) {
      groupedByFixVersion["No Fix Version"] =
        groupedByFixVersion["No Fix Version"] || [];
      groupedByFixVersion["No Fix Version"].push(slimIssue(issue));
    } else {
      for (const fv of fixVersions) {
        groupedByFixVersion[fv.name] = groupedByFixVersion[fv.name] || [];
        groupedByFixVersion[fv.name].push(slimIssue(issue));
      }
    }
  }
  return groupedByFixVersion;
}

function slimIssue(issue) {
  return {
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    issueType: issue.fields.issuetype.name,
    assignee: issue.fields.assignee ? issue.fields.assignee.displayName : null,
    reporter: issue.fields.reporter ? issue.fields.reporter.displayName : null,
  };
}

// ========================
// Prompt Construction
// ========================
function buildJiraPrompt(jiraData, query) {
  let summaryText = "";
  for (const [version, issues] of Object.entries(jiraData)) {
    summaryText += `Jira Version: ${version}\n`;
    for (const issue of issues) {
      summaryText += `- [${issue.key}] ${issue.summary} (${issue.issueType}, ${issue.status}) | Assignee: ${issue.assignee} | Reporter: ${issue.reporter}\n`;
    }
    summaryText += "\n";
  }
  return `${summaryText}Question: ${query}\nAnswer:`;
}

// ========================
// IBM Granite Call
// ========================
async function callGranite(prompt) {
  const accessToken = await getGraniteAccessToken();
  const { modelId, projectId } = getGraniteConfig();

  const resp = await axios.post(
    `https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29`,
    {
      model_id: modelId,
      input: prompt,
      parameters: { decoding_method: "greedy", max_new_tokens: 1000 },
      project_id: projectId,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );
  return resp.data;
}

// ========================
// Exported Functions
// ========================
exports.getJiraUserlatestREL = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const jiraData = await getLatestRelJiraData();
      res.json({ groupedByFixVersion: jiraData });
    } catch (error) {
      console.error("JIRA fetch error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
});

exports.pushJiraQuery = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const jiraData = await getLatestRelJiraData();
      const prompt = buildJiraPrompt(jiraData, query);
      res.json({ prompt });
    } catch (error) {
      console.error("Push prompt error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
});

exports.askGraniteJiraSummary = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const jiraData = await getLatestRelJiraData();
    //   console.log(jiraData)
      const prompt = buildJiraPrompt(
        jiraData,
        // "Summarize (Story, To Do) for REL2025.06.16."
        "Response shown be a JSON array of releases. each release item should contain release name, description of release and array of jiras in the release. In each jira item should have title , summary and assignee."
      );
      const graniteResp = await callGranite(prompt);
      res.json({ prompt, graniteResp });
    } catch (error) {
      console.error("Granite summary error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
});
