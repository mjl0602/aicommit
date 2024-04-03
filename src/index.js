#!/usr/bin/env node

const { program } = require("commander");
const fs = require("fs");
const { resolve } = require("path");
const { exec } = require("child_process");
const fetch = require("node-fetch");

const readline = require("readline");

const configPath = resolve(__dirname, "../config.json");
if (!fs.existsSync(configPath))
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        key: "",
        url: "",
        lang: "中文",
        command: 'git commit -am "{commit}"',
      },
      "",
      2
    ),
    {
      encoding: "utf-8",
    }
  );
const configFile = fs.readFileSync(configPath, {
  encoding: "utf-8",
});
const config = JSON.parse(configFile || "{}");

program.description("Auto write commit with GPT").action(async () => {
  if (!config.key) throw `Must set a key first like: aicommit set key=123456`;
  if (!config.url)
    throw `Must set a full url first like: aicommit set url=http://192.168.0.1:3000/api/v1/chat/completions`;

  const stdout = await new Promise((r, e) => {
    exec("git diff", (error, stdout, stderr) => {
      if (error) e(error);
      r(stdout);
    });
  });
  if (!stdout) {
    console.log("No change to commit");
    return;
  }
  const lang = config.lang;
  const prompt = [
    "你是Commit标题写作小助手",
    "这是一些代码变更信息",
    stdout,
    "----- 以上是代码变更信息 -----",
    "作为标题写作小助手，你只输出简短的commit标题，不输出其他任何信息",
    `现在，根据以上git diff提取到的的代码变更信息，用${
      lang || "中文"
    }写出一个简短的commit标题:`,
  ].join("\n");
  console.log("Generating commit...");
  //   console.log(prompt);
  const commitText = await askAI(config.key, config.url, prompt);
  //   console.log(commitText);

  // 询问问题
  const next = await new Promise((r) => {
    // 创建readline接口实例
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${commitText}(y/n)`, (answer) => {
      rl.close(); // 关闭接口实例
      if (answer.toLocaleLowerCase() == "y") {
        return r(true);
      }
      if (answer.toLocaleLowerCase() == "n") {
        return r(false);
      }
    });
  });
  if (!next) return;
  const commad = config.command || 'git commit -am "{commit}"';
  if (!~commad.indexOf("{commit}"))
    throw 'config.command must contains "{commit}" text';
  const finalCommand = commad.replace("{commit}", commitText);
  console.log(`RUN: ${finalCommand}`);
  const commitStdout = await new Promise((r, e) => {
    exec(finalCommand, (error, stdout, stderr) => {
      if (error) {
        e(error);
        return;
      }
      r(stdout);
    });
  });
  console.log(commitStdout);
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
    [
      "Config keys or command with AI.",
      "",
      "Command example: aicommit set key=123456",
      "",
      "ValidKey:",
      "key: FastGPT request key, must set before use",
      "url: FastGPT request url, must set before use",
      "command: Custom commit command",
      "lang: Commit language",
      "",
    ].join("\n")
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
