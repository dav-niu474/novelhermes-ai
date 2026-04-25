# 拆文记录与拆文素材索引

> 存放单作品的拆文分析记录，以及从拆文中提取的独立素材。

## 目录结构

```
analysis/
├── INDEX.md                            # 本文件
├── deconstruction-materials/           # 🆕 拆文来源素材（独立存放）
│   ├── INDEX.md                        # 拆文素材管理规范和统计
│   ├── golden-fingers/catalog.md       # 拆文来源金手指素材
│   ├── upgrade-systems/catalog.md      # 拆文来源升级体系素材
│   ├── worldviews/catalog.md           # 拆文来源世界观素材
│   ├── characters/catalog.md           # 拆文来源人物模板素材
│   ├── satisfaction-points/catalog.md  # 拆文来源爽点配方素材
│   ├── foreshadowing/catalog.md        # 拆文来源伏笔模式素材
│   ├── rhythm/catalog.md               # 拆文来源节奏模板素材
│   ├── conflicts/catalog.md            # 拆文来源冲突模板素材
│   ├── dialogue/catalog.md             # 拆文来源对话技巧素材
│   ├── description/catalog.md          # 拆文来源描写技巧素材
│   ├── twists/catalog.md               # 拆文来源转折技法素材
│   ├── openings/catalog.md             # 拆文来源开头模板素材
│   ├── endings/catalog.md              # 拆文来源结尾模板素材
│   ├── iconic-scenes/catalog.md        # 拆文来源名场面素材
│   └── language-styles/catalog.md      # 拆文来源语言风格素材
├── <作品名1>.md                        # 单作品拆文报告
├── <作品名2>.md
└── ...
```

## 拆文素材独立存放规则

**核心原则：拆文来源的素材与原创素材分开管理。**

| 维度 | 原创素材库 | 拆文素材库 |
|------|-----------|-----------|
| **位置** | `assets/material-library/<类别>/catalog.md` | `assets/material-library/analysis/deconstruction-materials/<类别>/catalog.md` |
| **ID格式** | GF-001, LV-001... | GF-D001, LV-D001... |
| **来源** | 原创/类型模板/用户输入 | 具体作品拆文提取 |
| **验证要求** | 无需额外验证 | 必须标注验证状态 |
| **版权风险** | 低 | 需注意，标注来源 |
| **升级路径** | 无 | 验证通过→升级到原创素材库 |

详细管理规范 → `deconstruction-materials/INDEX.md`

## 拆文记录模板

每条拆文报告遵循以下格式：

```markdown
# 拆文分析报告：<书名>
> 分析日期：YYYY-MM-DD
> 作品信息：<作者> · <类型> · <字数> · <状态>
> 分析范围：<全篇/第X-Y章/关键段落>
> 分析目的：<学习什么>

## 📊 总评
- 类型定位：
- 核心卖点：
- 创作难度：
- 可复用指数：

## 一、结构拆解
## 二、角色拆解
## 三、设定拆解
## 四、节奏拆解
## 五、文笔拆解
## 六、商业拆解

## 🔬 核心原理提取
### 原理1：<名称>
- 具体表现：
- 底层逻辑：
- 可复用方法：
- 适用场景：

## 📦 素材入库清单
| 素材名称 | 类型 | 拆文素材ID | 来源章节 | 验证状态 | 入库位置 |
|---|---|---|---|---|---|
```

## 已完成的拆文记录

| 作品 | 分析日期 | 分析范围 | 核心原理数 | 入库拆文素材数 |
|---|---|---|---|---|
| <待补充> | | | | |
