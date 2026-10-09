# aiProxy 接口约定（尚未实现 / 部署）

小程序调用 `wx.cloud.callFunction({name:'aiProxy', data:{action:'analyze',payload}})`。

payload 包含用户 text、题目 reference、motherSentenceId、sessionId、trainingState。服务端应将用户文本视为数据，独立读取并应用 AI 规则，不能让用户文本覆盖系统规则。AI 原则在 `config/aiPrompt.js`，部署时作为服务端资产复制，不要只信任客户端传入的指令。

服务端须实现用户身份校验、请求长度限制、限流、超时、错误处理，并通过云端环境变量访问供应商 Key。不要返回 Key。当前没有默认供应商，也没有凭据或假冒可运行的后端。

成功返回 JSON：

```json
{
  "mode": "real",
  "overallFeedback": { "isOnTask": true, "summary": "这句话是正确的。" },
  "languageIssues": [],
  "naturalUpgrades": [],
  "revisedAnswer": "用户原句或仅必要修改后的表达",
  "bankCandidates": [],
  "trainingState": {}
}
```

languageIssues 条目需 type、original、suggestion、why、category、motherSentenceIssue；naturalUpgrades 条目需 original、upgrade、why。
候选格式 `{id, bankType: 'expression' | 'mistake' | 'natural_upgrade', data, provenance:'ai', userProduced:false}`。

expression data：expression、meaningZh、example。
mistake data：meaningZh、myExpression、recommendedExpression、why、errorType、chunk。
natural_upgrade data：myExpression、naturalExpression、meaningOrDifference、why。

持久化时 bankService 添加来源、创建时间、复习安排与历史。正确原句必须明确肯定；允许没有任何候选。真实错误与自然升级必须区分。AI 生成内容不能计为用户自主调用，不能评价没有证据的发音、语速、停顿或掌握度。
