#!/usr/bin/env node
/**
 * MBTI 测评程序静态校验脚本
 * 在 CI（GitHub Actions）中触发执行，无需任何外部依赖。
 * 校验项：
 *   1. index.html 存在且为有效 HTML
 *   2. 题库共 20 题，四个维度各 5 题
 *   3. 每题的 dim 与 aVal/bVal 归属一致
 *   4. 16 型人格描述全部存在
 *   5. 8 个维度说明齐全
 * 任一校验失败则以退出码 1 阻断 CI。
 */

const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "index.html");

function fail(msg) {
  console.error("  ✗ " + msg);
  return false;
}

function pass(msg) {
  console.log("  ✓ " + msg);
  return true;
}

function main() {
  console.log("MBTI 项目静态校验开始…\n");

  if (!fs.existsSync(htmlPath)) {
    console.error("未找到 index.html，校验失败。");
    process.exit(1);
  }
  const html = fs.readFileSync(htmlPath, "utf-8");

  // ---------- 1. HTML 基本结构 ----------
  let ok = true;
  if (!/<html[\s>]/i.test(html)) ok = fail("未找到 <html> 标签") && ok;
  else ok = pass("存在 <html> 标签");

  if (!/<body[\s>]/i.test(html)) ok = fail("未找到 <body> 标签") && ok;
  else ok = pass("存在 <body> 标签");

  // ---------- 2. 题库解析 ----------
  const qBlock = html.match(/const questions\s*=\s*\[([\s\S]*?)\n\];/);
  if (!qBlock) {
    console.error("无法从 index.html 解析 questions 数组，请检查数据结构。");
    process.exit(1);
  }
  const qLines = qBlock[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//") && l.startsWith("{"));
  pass("解析到题库数组，共 " + qLines.length + " 行题目");

  const dimCount = { EI: 0, SN: 0, TF: 0, JP: 0 };
  const dimValues = { EI: ["E", "I"], SN: ["S", "N"], TF: ["T", "F"], JP: ["J", "P"] };

  for (let i = 0; i < qLines.length; i++) {
    const line = qLines[i];
    const text = (line.match(/text:\s*"([^"]*)"/) || [])[1];
    const dim = (line.match(/dim:\s*"([^"]*)"/) || [])[1];
    const aVal = (line.match(/aVal:\s*"([^"]*)"/) || [])[1];
    const bVal = (line.match(/bVal:\s*"([^"]*)"/) || [])[1];

    const num = i + 1;
    if (!text) { ok = fail("第 " + num + " 题缺少 text") && ok; continue; }
    if (!Object.prototype.hasOwnProperty.call(dimValues, dim)) { ok = fail("第 " + num + " 题 dim 无效：" + dim) && ok; continue; }
    dimCount[dim]++;

    const expect = dimValues[dim];
    if (!(expect.includes(aVal) && expect.includes(bVal) && aVal !== bVal)) {
      ok = fail("第 " + num + " 题 dim " + dim + " 与选项 " + aVal + "/" + bVal + " 不符") && ok;
    }
  }

  // ---------- 3. 每维度题数 ----------
  for (const dim of Object.keys(dimValues)) {
    const count = dimCount[dim];
    if (count !== 5) ok = fail("维度 " + dim + " 应有 5 题，实际 " + count + " 题") && ok;
    else ok = pass("维度 " + dim + " 有 " + count + " 题");
  }
  if (qLines.length !== 20) ok = fail("题库总数应为 20 题，实际 " + qLines.length + " 题") && ok;

  // ---------- 4. 16 型描述 ----------
  const tdBlock = html.match(/const typeDescriptions\s*=\s*\{([\s\S]*?)\n\};/);
  const allTypes = ["INTJ","INTP","ENTJ","ENTP","INFJ","INFP","ENFJ","ENFP","ISTJ","ISFJ","ESTJ","ESFJ","ISTP","ISFP","ESTP","ESFP"];
  if (!tdBlock) {
    ok = fail("无法解析 typeDescriptions") && ok;
  } else {
    for (const t of allTypes) {
      const re = new RegExp(t + '\\s*:\\s*"');
      if (re.test(tdBlock[0])) ok = pass("类型 " + t + " 描述存在") && ok;
      else ok = fail("缺少类型 " + t + " 的描述") && ok;
    }
  }

  // ---------- 5. 维度说明 ----------
  const diBlock = html.match(/const dimInfo\s*=\s*\{([\s\S]*?)\n\};/);
  const allDims = ["E", "I", "S", "N", "T", "F", "J", "P"];
  if (!diBlock) {
    ok = fail("无法解析 dimInfo") && ok;
  } else {
    for (const d of allDims) {
      const re = new RegExp("\\b" + d + "\\s*:\\s*\\{");
      if (re.test(diBlock[1])) pass("维度 " + d + " 说明存在") && ok;
      else ok = fail("缺少维度 " + d + " 的说明") && ok;
    }
  }

  // ---------- 汇总 ----------
  console.log("");
  if (ok) {
    console.log("全部校验通过 ✔");
    process.exit(0);
  } else {
    console.error("存在校验失败项，阻断发布。");
    process.exit(1);
  }
}

main();