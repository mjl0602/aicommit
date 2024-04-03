const { program } = require("commander");
const fs = require("fs");
const { resolve } = require("path");
const { exec } = require("child_process");

const configPath = resolve(__dirname, "../config.json");
if (!fs.existsSync(configPath))
  fs.writeFileSync(configPath, JSON.stringify({}, "", 2), {
    encoding: "utf-8",
  });
const configFile = fs.readFileSync(configPath, {
  encoding: "utf-8",
});
const config = JSON.parse(configFile || "{}");

program.description("Auto write commit with GPT").action(async () => {
  if (!config.key) throw `Must set a key first like: aicommit set key=123456`;
  if (!config.url)
    throw `Must set a full url first like: aicommit set url=http://192.168.0.1:3000/api/v1/chat/completions`;

  exec("git", ["diff"]);
  const prompt = [
    "你是Commit标题写作小助手，你通过git diff的代码变更信息写作commit标题",
  ].join("\n");

  const response = await askAI(config.key, config.url, prompt);
  console.log(response);
});

async function askAI(key, host, text) {
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  const body = JSON.stringify({
    chatId: null,
    stream: false,
    detail: false,
    messages: [{ content: text, role: "user" }],
  });

  try {
    const response = await fetch(`${host}`, {
      method: "POST",
      headers: headers,
      body: body,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // Assuming the structure of the response is similar to what you've described in Dart
    return data["choices"][0]["message"]["content"].toString();
  } catch (error) {
    console.error("Error fetching data: ", error);
    return null; // or handle the error in another way
  }
}

program
  .command("config [action] [value]")
  .description(
    "Config keys or command with AI.\nExample: aicommit set key=123456"
  )
  .action(async (action, value) => {
    if (action == "set") {
      const [k, v] = value.split("=");
      if (!v) throw "Must set a value like: aicommit set key=123456";
      config[k] = v;
      console.log(`Set success: ${k} = ${v}`);
    } else if (action == "get") {
      const [k, v] = value.split("=");
      config[k] = v;
      console.log(`confog.${k} = ${v}`);
    } else if (action == "delete") {
      const [k, v] = value.split("=");
      delete config[k];
      console.log(`Delete success: ${k}`);
    } else if (!action) {
      console.log(`\nAICommit config:`);
      for (const et of Object.entries(config)) {
        console.log(`config.${et[0]} = ${et[1]}`);
      }
      console.log("");
    } else {
      throw `Invalid command ${action}. Avaliable: get/set/delete`;
    }
    fs.writeFileSync(configPath, JSON.stringify(config, "", 2), {
      encoding: "utf-8",
    });
  });

// 设置版本
program.version("2.0.0");

program.parse(process.argv);
