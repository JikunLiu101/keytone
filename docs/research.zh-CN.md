# Keytone — 前期调研

> 调研日期：2026-10-21。星数、许可证、最近更新时间均来自 GitHub API 当日数据。

目标：纯前端网页 app，以钢琴键盘的形式演奏电子琴及其他乐器音色。

## 1. 结论速览

- **没有一个成熟的开源项目和我们的目标完全一致**。现有的要么是"音频库"（只管发声，不管界面），要么是功能很单薄的 demo 级钢琴页面。
- 最合理的路线是 **自己写界面 + 复用成熟的音频库和免费音色样本**，不需要 fork 任何现成 app。
- 纯静态站点，**部署成本基本为 0**（Cloudflare Pages / GitHub Pages / Vercel 免费档都够用）。唯一要规划的是音色样本文件的体积和托管位置。

## 2. 调研对象

### 2.1 发声引擎（核心可复用）

| 项目 | Stars | 许可证 | 最近更新 | 说明 |
|---|---|---|---|---|
| [danigb/smplr](https://github.com/danigb/smplr) | 328 | MIT | 2026-09 | **首选候选**。开箱即用的采样乐器库：GM 音色、Steinway 钢琴(4 层力度)、4 种电钢琴、鼓机、马林巴、Mellotron、低音提琴，可直接读 .sf2。自带混响、CacheStorage 缓存、延音踏板(CC64)。样本默认托管在 GitHub，也可以换成自己的地址。v1.x，作者说 1.0 前 API 可能变 |
| [Tonejs/Tone.js](https://github.com/Tonejs/Tone.js) | 14.8k | MIT | 2026-10 | 最主流的 Web Audio 框架：合成器、效果器、Sampler、时间调度。适合做"合成器类"音色(电子琴、Lead、Pad)和效果链。本身不带乐器样本 |
| [spessasus/spessasynth_lib](https://github.com/spessasus/spessasynth_lib) | 53 (主项目 413) | Apache-2.0 | 2026-10 | 浏览器里的完整 SoundFont(SF2/SF3/DLS) 合成器，跑在 AudioWorklet 线程。加载一个 GM 音色库就有 128 种乐器 + 鼓，音质和"电子琴"的感觉最接近。代价是要下载整包音色库(几十 MB) |
| [surikov/webaudiofont](https://github.com/surikov/webaudiofont) | 991 | **GPL-3.0** | 2026-09 | 数千种音色的目录，很全。但**代码是 GPL**，引用后整个项目也得开源为 GPL，选用前要想清楚 |
| [g200kg/webaudio-tinysynth](https://github.com/g200kg/webaudio-tinysynth) | 270 | Apache-2.0 | 2022-12 | 纯合成的 GM 音源，零样本、极小体积，音质一般。可作为"离线/秒开"兜底 |
| [jet2jet/js-synthesizer](https://github.com/jet2jet/js-synthesizer) | 79 | BSD-3 | 2026-08 | FluidSynth 的 WASM 版，功能强但偏重 |
| [danigb/soundfont-player](https://github.com/danigb/soundfont-player) | 476 | MIT | 已归档 | 已被 smplr 取代，不要用 |

### 2.2 免费音色样本

| 来源 | 许可证 | 备注 |
|---|---|---|
| [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) — FluidR3_GM | CC BY 3.0 | 128 种 GM 乐器，已切好按乐器单独加载(mp3/ogg)。smplr 的默认 GM 来源 |
| 同上 — MusyngKite / FatBoy | CC BY-SA 3.0 | 音质更好，但 SA 条款要求衍生的音色也以相同许可发布 |
| [smpldsnds](https://github.com/smpldsnds) 组织 | 多为 CC0 / 公有领域 / CC BY 3.0 | Splendid Grand Piano(公有领域)、Rhodes(CC0)、Greg Sullivan 电钢(CC BY 3.0)、VCSL 管弦/打击(CC0) 等。smplr 直接用 |
| [GeneralUser GS](https://github.com/mrbumpy409/GeneralUser-GS) | 自有许可，允许商用和随软件分发 | 体积小、质量好的 GM SoundFont，配 SpessaSynth 很合适。作者要求不要直接外链他的下载地址，要自己托管一份 |
| [Salamander Grand Piano](https://github.com/sfzinstruments/SalamanderGrandPiano) | CC BY 3.0 | 高质量钢琴，[tambien/Piano](https://github.com/tambien/Piano) (MIT) 是基于 Tone.js 的封装 |
| [nbrosowsky/tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) | 未声明(样本大多 CC BY) | 约 20 种乐器，给 Tone.js 用的快速加载器。许可证不明确，谨慎 |

### 2.3 键盘界面 / 输入

| 项目 | Stars | 许可证 | 说明 |
|---|---|---|---|
| [kevinsqi/react-piano](https://github.com/kevinsqi/react-piano) | 318 | MIT | React 钢琴键盘组件，支持鼠标/触屏/电脑键盘映射。2023 后无更新，可参考或直接借用 |
| [tigranpetrossian/klavier](https://github.com/tigranpetrossian/klavier) | — | — | 较新的轻量 React 键盘库 |
| [stuartmemo/qwerty-hancock](https://github.com/stuartmemo/qwerty-hancock) | 275 | MIT | 框架无关的键盘 UI，仍在维护 |
| [kylestetz/AudioKeys](https://github.com/kylestetz/AudioKeys) | 243 | MIT | 只做"电脑键盘 → 音符"映射，处理了按键重复、复音等细节 |
| [djipco/webmidi](https://github.com/djipco/webmidi) | 1.7k | Apache-2.0 | 接入外部 MIDI 键盘(Web MIDI API)的标准库 |

### 2.4 完整应用（参考架构和交互，而非直接复用）

| 项目 | Stars | 许可证 | 可借鉴之处 |
|---|---|---|---|
| [ryohey/signal](https://github.com/ryohey/signal) | 2.4k | MIT | 成熟的在线 MIDI 编辑器(TS + React)，用 SoundFont 发声，纯前端部署。参考其音频引擎与 UI 分层 |
| [googlecreativelab/chrome-music-lab](https://github.com/googlecreativelab/chrome-music-lab) | 2.4k | Apache-2.0 | 交互设计和视觉反馈的标杆，代码较老 |
| [johnnesky/beepbox](https://github.com/johnnesky/beepbox) | 1.2k | MIT | 纯合成音色、纯静态站点、分享链接即作品 |
| [spessasus/SpessaSynth](https://spessasus.github.io/SpessaSynth/) | 413 | Apache-2.0 | 自带虚拟键盘 + 换音色的演示页，最接近我们的功能形态 |
| [Klavier (Vict1111-code)](https://github.com/Vict1111-code/klavier-Virtual_Keyboard) | 小 | — | 纯 HTML/JS，10 种合成音色，电脑键盘演奏。功能接近但规模是 demo 级 |
| Online-Piano / webaudiofont-piano / Open-Web-Piano 等 | 0–32 | 多无许可证 | demo 级，无许可证的**不能复用代码** |

## 3. 常见架构

所有像样的项目基本都是同一个分层：

```
输入层   鼠标/触屏  电脑键盘  外部 MIDI 键盘
   ↓        (统一转换成 noteOn / noteOff / CC 事件)
控制层   音色选择、八度/移调、力度、延音、音量
   ↓
音频引擎  采样播放(smplr) 或 SoundFont 合成(SpessaSynth) 或 合成器(Tone.js)
   ↓
效果链   混响 / 均衡 / 主音量 → AudioContext.destination
```

关键设计点：
- **输入统一成 MIDI 风格事件**：界面、键盘、MIDI 设备都只产生 `noteOn(note, velocity)` / `noteOff(note)`，引擎不关心来源。之后加录音/回放也很容易。
- **引擎做成可替换的接口**：不同音色可能来自不同后端(钢琴用采样、电子琴用合成)，上层只认一个 `Instrument` 接口。
- **按需加载音色**：只在切换到某个乐器时才下载它的样本，配合 Cache API / Service Worker 缓存，第二次打开秒开、可离线。
- **浏览器必须在用户第一次点击后才能出声**(AudioContext 解锁)，需要一个"点击开始"之类的交互。
- **延迟**：Web Audio 本身延迟 10–30ms 左右，可接受；电脑键盘要处理按住自动重复和"幽灵键"(多键同按的硬件限制)。

## 4. 部署成本

纯静态站点，构建产物就是 HTML/JS/CSS + 音色文件。

| 方案 | 费用 | 限制 |
|---|---|---|
| Cloudflare Pages | 免费 | 单文件 ≤ 25 MiB，单站 ≤ 20,000 个文件，每月 500 次构建；静态流量不计费 |
| GitHub Pages | 免费 | 仓库建议 ≤ 1 GB；有流量软上限 |
| Vercel / Netlify 免费档 | 免费 | 约 100 GB/月流量 |
| 样本放 Cloudflare R2 | 10 GB 内免费，出口流量免费 | 适合以后样本变大 |
| 直接用 smplr 默认的 GitHub 托管样本 | 免费 | 有频率限制，不受我们控制，适合原型期 |

体积估算：按乐器单独加载的 mp3 样本，每种约 0.5–3 MB；一个 GM SoundFont(sf3 压缩) 约 10–30 MB，超过 25 MiB 需要放 R2 或拆分。

**结论：原型到正式上线都可以 0 成本，自定义域名约 10 美元/年。**

## 5. 建议复用清单

| 用途 | 建议 | 理由 |
|---|---|---|
| 主要音频引擎 | **smplr** | MIT，钢琴/电钢/GM/鼓都现成，API 简单，可换自托管样本 |
| 合成器类音色、效果 | **Tone.js**(按需) | 想做"复古电子琴/合成器"音色时再引入 |
| 全套 GM 128 音色(可选) | **SpessaSynth + GeneralUser GS** | 如果目标是"像一台电子琴，什么音色都有" |
| 键盘界面 | 自己写，参考 react-piano | 界面是产品差异所在，组件本身不复杂 |
| 电脑键盘映射 | 参考/借用 AudioKeys 的逻辑 | 坑都处理过 |
| 外部 MIDI 键盘 | WEBMIDI.js(可选) | 一个模块即可接入 |
| 避免 | WebAudioFont(GPL)、无许可证的小项目、soundfont-player(已归档) | 许可证风险 / 不维护 |

样本许可证提醒：优先用 CC0 / 公有领域 / CC BY 的样本；CC BY 需要在页面里署名；CC BY-SA(MusyngKite、FatBoy)尽量避开。

## 6. 待定的需求问题

需求细节通过 grill-me 访谈确认，确认后再定技术选型。
