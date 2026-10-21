# Keytone

[English](README.md)

在浏览器里用电脑键盘弹电子琴。无需服务器，无需安装。

> 开发中（里程碑 M1：三角钢琴、按键映射、八度键、延音、鼠标弹奏）。

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

然后打开 http://localhost:5173。

## 怎么弹

| 按键 | 音 |
|---|---|
| `Z X C V B N M` | C D E F G A B（C3–B3） |
| `S D G H J` | C# D# F# G# A# |
| `, . /` 和 `L ;` | C4 D4 E4 和 C#4 D#4 |
| 按住 `左 Shift` / `右 Shift` | 降 / 升一个八度 |
| 按住 `空格` | 延音踏板 |

也可以用鼠标点击，或在屏幕琴键上拖动。

## 文档

- [产品说明](docs/spec.zh-CN.md)
- [调研报告](docs/research.zh-CN.md)

## 许可证

代码采用 [MIT](LICENSE) 许可证。乐器样本从 [smplr](https://github.com/danigb/smplr) 的托管地址加载，各自沿用原有许可证。三角钢琴音色为 Splendid Grand Piano，属于公有领域。
