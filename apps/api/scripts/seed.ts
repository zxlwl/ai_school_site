/**
 * 示例数据写入脚本。
 *
 * 目的：新部署的站点不应是空白页——前台一打开就有完整内容可看，
 * 后台也有可编辑的真实数据作为模板。
 *
 * 幂等性：通过 slug 判断是否已存在，重复执行不会产生重复数据。
 * 用法：pnpm db:seed
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const root = join(__dirname, '..', '..', '..')
  const candidates = [join(root, '.env'), join(__dirname, '..', '.env')]
  for (const file of candidates) {
    try {
      const content = readFileSync(file, 'utf8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const idx = trimmed.indexOf('=')
        if (idx === -1) continue
        const key = trimmed.slice(0, idx).trim()
        let value = trimmed.slice(idx + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        if (!process.env[key]) process.env[key] = value
      }
    } catch {
      /* 文件不存在时继续尝试下一个 */
    }
  }
}

loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('❌ 未找到 DATABASE_URL，请先配置 .env')
  process.exit(1)
}

const sql = postgres(url, { max: 1, prepare: false })

/* ------------------------------------------------------------------ */
/* 内容定义                                                            */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  { name: '校园新闻', slug: 'campus-news', color: '#2563eb', sort: 1, description: '学校重要活动与日常动态' },
  { name: '通知公告', slug: 'notices', color: '#f59e0b', sort: 2, description: '面向师生与家长的正式通知' },
  { name: '教学科研', slug: 'academics', color: '#059669', sort: 3, description: '课程建设、教研成果与学术活动' },
  { name: '学生活动', slug: 'student-life', color: '#7c3aed', sort: 4, description: '社团、竞赛、文体活动' },
  { name: '招生招聘', slug: 'admissions', color: '#dc2626', sort: 5, description: '招生信息与教师招聘' },
]

const ARTICLES: Array<{
  title: string
  slug: string
  category: string
  featured: boolean
  cover: string | null
  author: string
  excerpt: string
  content: string
  daysAgo: number
  views: number
}> = [
  {
    title: '我校隆重举行2026年春季学期开学典礼',
    slug: 'spring-2026-opening-ceremony',
    category: 'campus-news',
    featured: true,
    cover: null,
    author: '校办公室',
    excerpt: '春风送暖，万象更新。3月2日上午，全校师生齐聚体育馆，共同迎接新学期的到来。',
    content: `春风送暖，万象更新。3月2日上午，全校师生齐聚体育馆，共同迎接2026年春季学期的到来。

## 校长致辞

校长在致辞中回顾了过去一年学校取得的各项成绩，并向全体师生提出三点期望：

1. **保持好奇** —— 学习的起点永远是一个真诚的问题
2. **学会合作** —— 一个人的力量有限，一群人才能走得更远
3. **坚持锻炼** —— 健康的体魄是一切可能性的基础

> 教育的本质，不是把篮子装满，而是把灯点亮。

## 学生代表发言

高三年级学生代表分享了她的学习心得，特别提到时间管理的重要性：

- 每天留出固定的复盘时间
- 把大目标拆解成一周内可完成的小任务
- 遇到困难先自己尝试，再向老师和同学求助

## 新学期安排

教务处随后公布了本学期的教学日历与重要活动安排，详情请关注后续通知。`,
    daysAgo: 2,
    views: 1247,
  },
  {
    title: '关于2026年清明节放假安排的通知',
    slug: 'qingming-holiday-2026',
    category: 'notices',
    featured: true,
    cover: null,
    author: '教务处',
    excerpt: '根据国务院办公厅通知精神，结合我校实际，现将清明节放假安排通知如下。',
    content: `各部门、各年级组：

根据国务院办公厅《关于2026年部分节假日安排的通知》精神，结合我校实际情况，现将清明节放假安排通知如下：

## 放假时间

**4月4日（星期六）至4月6日（星期一）放假，共3天。**

4月7日（星期二）正常上课，按周二课表执行。

## 注意事项

1. 各班主任放假前须完成安全教育，重点强调交通安全与防火安全
2. 留校学生须向宿管中心报备，学校安排专人值班
3. 后勤部门做好假期水电安全检查，值班表另发

## 值班安排

假期值班电话：010-0000 0000

请各部门提前做好工作安排，确保假期校园安全稳定。

教务处
2026年3月20日`,
    daysAgo: 5,
    views: 2891,
  },
  {
    title: '我校学生在第38届全国青少年科技创新大赛中获佳绩',
    slug: 'national-innovation-award-38',
    category: 'student-life',
    featured: true,
    cover: null,
    author: '教务处',
    excerpt: '在刚刚结束的第38届全国青少年科技创新大赛中，我校代表队斩获一等奖2项、二等奖3项。',
    content: `在刚刚结束的第38届全国青少年科技创新大赛中，我校代表队表现优异，共获得：

- **一等奖 2 项**
- **二等奖 3 项**
- **三等奖 4 项**

## 获奖项目

| 项目名称 | 完成人 | 奖项 |
| --- | --- | --- |
| 基于机器视觉的校园垃圾分类装置 | 高二(3)班 李明 | 一等奖 |
| 城市内涝预警的低成本传感网络 | 高三(1)班 王雨 | 一等奖 |
| 可降解植物纤维包装材料研究 | 高二(7)班 张涛 | 二等奖 |

## 背后的故事

李明同学的项目历时八个月，从最初的一个想法到最终成型的装置，经历了十余次方案迭代。指导老师表示，最难的不是技术实现，而是让学生学会在失败中坚持。

> 失败不是终点，而是数据。

学校将继续加大科技创新教育的投入，为更多学生提供探索的平台。`,
    daysAgo: 8,
    views: 1876,
  },
  {
    title: '关于深化课堂教学改革的实施意见',
    slug: 'classroom-reform-guideline',
    category: 'academics',
    featured: false,
    cover: null,
    author: '教研室',
    excerpt: '为进一步提升课堂教学质量，学校决定全面推行以学生为中心的课堂教学改革。',
    content: `## 一、指导思想

以立德树人为根本任务，坚持"以学生为中心"的教学理念，推动课堂教学从"教师讲授为主"向"学生主动探究为主"转变。

## 二、主要措施

### 1. 推行问题导向教学

鼓励教师以真实问题驱动课堂，减少单向讲授时间，增加学生讨论与展示环节。

### 2. 建设学科资源库

各教研组在一年内完成本学科优质课件、习题与微课视频的整理入库。

### 3. 完善评价体系

将课堂参与度、小组合作表现纳入过程性评价，占比不低于总评的 30%。

## 三、实施步骤

- **第一阶段（本学期）**：语文、数学、英语三个学科试点
- **第二阶段（下学期）**：全学科推广
- **第三阶段（明年）**：总结提炼形成校本教学模式

## 四、保障机制

学校将设立专项经费支持教师培训与资源建设，每学期组织一次教学改革经验交流会。

教研室
2026年3月10日`,
    daysAgo: 15,
    views: 934,
  },
  {
    title: '校园开放日活动圆满结束，近千名家长到访',
    slug: 'open-day-2026',
    category: 'campus-news',
    featured: false,
    cover: null,
    author: '校办公室',
    excerpt: '3月15日，我校举办校园开放日活动，近千名家长与小学毕业生走进校园，体验真实课堂。',
    content: `3月15日，我校举办了一年一度的校园开放日活动，共有近千名家长与小学毕业生到访。

## 活动内容

- **课堂体验**：开放 12 节真实课堂，涵盖语文、数学、英语、物理、美术等学科
- **社团展示**：机器人社、辩论社、合唱团等 18 个社团现场展示
- **校园导览**：学生志愿者带领参观图书馆、实验楼、体育馆与宿舍区
- **招生咨询**：教务处老师现场解答招生政策与升学路径

## 家长反馈

多位家长表示，最打动他们的是学生志愿者自信从容的表达。一位家长说："孩子在这里不只是学知识，更是学做人。"

## 后续安排

招生简章将于 4 月中旬发布，请关注本网站"招生招聘"栏目。`,
    daysAgo: 20,
    views: 1523,
  },
  {
    title: '关于开展2026年春季研学实践活动的通知',
    slug: 'spring-study-tour-2026',
    category: 'notices',
    featured: false,
    cover: null,
    author: '德育处',
    excerpt: '为拓展学生视野，学校将于4月组织春季研学实践活动，现就有关事项通知如下。',
    content: `各年级组、各班主任：

为拓展学生视野、增强实践能力，学校决定于 4 月组织春季研学实践活动。

## 活动安排

| 年级 | 地点 | 时间 |
| --- | --- | --- |
| 高一 | 国家博物馆、故宫博物院 | 4月12日 |
| 高二 | 中科院物理研究所 | 4月13日 |
| 高三 | 本校（备考冲刺，不安排外出） | — |

## 报名方式

请各班班主任于 3 月 28 日前将参加名单报德育处。

## 安全要求

1. 每班配备 2 名带队教师，全程跟队
2. 学生须穿着校服，佩戴校徽
3. 严禁携带贵重物品，手机由带队教师统一保管

德育处
2026年3月18日`,
    daysAgo: 12,
    views: 1167,
  },
  {
    title: '我校与师范大学签署教师培养合作协议',
    slug: 'teacher-training-cooperation',
    category: 'academics',
    featured: false,
    cover: null,
    author: '校办公室',
    excerpt: '3月8日，我校与师范大学举行签约仪式，双方将在教师培养、教育实习等方面深度合作。',
    content: `3月8日，我校与师范大学教师教育合作协议签约仪式在校会议室举行。

## 合作内容

1. **教育实习基地**：每年接收 30 名师范生到校实习
2. **教师研修**：选派骨干教师参与大学的教育硕士课程
3. **联合教研**：共同开展课堂教学改革课题研究
4. **资源共享**：大学图书馆与实验室向我校教师开放

## 意义

此次合作将打通"高校理论"与"中学实践"之间的通道。校长在致辞中表示，最好的教师培训不在报告厅，而在真实的课堂里。

双方还就人工智能辅助教学、学习数据分析等前沿议题进行了交流。`,
    daysAgo: 25,
    views: 742,
  },
  {
    title: '第26届校园文化艺术节精彩回顾',
    slug: 'arts-festival-26',
    category: 'student-life',
    featured: false,
    cover: null,
    author: '团委',
    excerpt: '为期一周的第26届校园文化艺术节落下帷幕，百余个节目、上千件作品参与展示。',
    content: `为期一周的第26届校园文化艺术节圆满落幕。本届艺术节以"青春的注脚"为主题，共有百余个节目、上千件作品参与展示。

## 精彩瞬间

### 开幕式

高一(5)班的打击乐《鼓动青春》以震撼的节奏点燃全场。

### 美术作品展

共展出绘画、书法、摄影、手工作品 800 余件，其中 32 件入选市级展览。

### 校园歌手大赛

高三(2)班同学以一首原创歌曲《晚自习的窗》夺得冠军，歌曲创作灵感来自真实的备考生活。

### 社团嘉年华

18 个社团在操场设立展位，机器人社的机械臂互动体验排队最长。

## 结语

艺术节的意义不在于名次，而在于让每个学生都有机会站上属于自己的舞台。`,
    daysAgo: 30,
    views: 2015,
  },
  {
    title: '2026年教师招聘公告（第一批）',
    slug: 'teacher-recruitment-2026-1',
    category: 'admissions',
    featured: false,
    cover: null,
    author: '人事处',
    excerpt: '因学校发展需要，现面向社会公开招聘各学科教师若干名，欢迎优秀人才加入。',
    content: `因学校发展需要，现面向社会公开招聘教师，有关事项公告如下。

## 招聘岗位

| 学科 | 人数 | 学历要求 |
| --- | --- | --- |
| 语文 | 2 | 本科及以上 |
| 数学 | 2 | 本科及以上 |
| 英语 | 2 | 本科及以上 |
| 物理 | 1 | 硕士及以上 |
| 信息技术 | 1 | 本科及以上 |

## 应聘条件

1. 热爱教育事业，品行端正，身心健康
2. 具备相应学科教师资格证
3. 有教学经验或竞赛指导经验者优先
4. 年龄一般不超过 40 周岁

## 待遇

- 提供具有竞争力的薪酬，具体面议
- 按规定缴纳五险一金
- 提供教师周转宿舍
- 支持在职进修与职称评定

## 应聘方式

请将个人简历、学历证书、教师资格证扫描件发送至 office@example.edu.cn，邮件标题格式为"应聘学科+姓名"。

报名截止日期：2026年4月30日

人事处`,
    daysAgo: 18,
    views: 3412,
  },
  {
    title: '如何帮助孩子度过高三：给家长的五条建议',
    slug: 'advice-for-parents',
    category: 'academics',
    featured: false,
    cover: null,
    author: '心理辅导中心',
    excerpt: '高三不仅是学生的考验，也是家长的功课。心理辅导中心整理了几点建议，供家长参考。',
    content: `高三不仅是学生的考验，也是家长的功课。心理辅导中心结合多年咨询经验，整理以下建议。

## 一、把关注点从"分数"转向"状态"

频繁询问成绩会加剧焦虑。可以改为："今天有什么让你觉得有意思的事吗？"

## 二、保证睡眠，这比多做一套卷子更重要

长期睡眠不足会显著降低记忆巩固效率。请家长协助孩子建立稳定的作息。

## 三、提供稳定的情绪环境

家长的焦虑会传递给孩子。如果自己也紧张，先处理好自己的情绪再与孩子沟通。

## 四、尊重孩子的节奏

有的孩子需要倾诉，有的需要独处。不要强迫他们按你期待的方式表达。

## 五、记住高考不是终点

一个健康、有韧性、知道自己想要什么的人，无论去哪所大学，都会走出自己的路。

---

如遇持续的失眠、情绪低落或食欲改变，请及时联系学校心理辅导中心，我们提供免费咨询。`,
    daysAgo: 35,
    views: 1654,
  },
]

const ANNOUNCEMENTS = [
  {
    title: '2026年清明节放假安排：4月4日至6日',
    level: 'important',
    pinned: true,
    content: '根据国务院办公厅通知，我校清明节放假时间为4月4日至4月6日，共3天。4月7日（星期二）正常上课，按周二课表执行。请各班主任做好假期安全教育。',
    daysAgo: 5,
  },
  {
    title: '校园网系统维护通知',
    level: 'info',
    pinned: true,
    content: '为提升访问速度，学校官网将于本周日 02:00–05:00 进行系统维护，期间可能无法访问。给您带来不便，敬请谅解。',
    daysAgo: 3,
  },
  {
    title: '关于做好春季传染病防控工作的通知',
    level: 'urgent',
    pinned: false,
    content: '近期流感高发，请各班做好晨午检记录，发现异常及时上报校医室。教室每日通风不少于3次，每次不少于30分钟。',
    daysAgo: 9,
  },
  {
    title: '家长会通知：本周六上午9点',
    level: 'important',
    pinned: false,
    content: '本学期期中家长会定于本周六上午9点在各班教室举行，请家长准时参加。会议将通报期中考试情况并交流后续教学安排。',
    daysAgo: 14,
  },
]

const PAGES = [
  {
    title: '学校简介',
    slug: 'about',
    sort: 1,
    content: `## 关于我们

明德中学创办于1956年，是一所拥有近七十年办学历史的公办完全中学。学校现有教学班 42 个，在校学生 2100 余人，教职工 186 人。

## 办学理念

**明德笃学 · 知行合一**

我们相信，教育的意义不仅在于传授知识，更在于培养健全的人格与独立的思考能力。

## 办学特色

- **小班化教学**：班额控制在 45 人以内，保证每个学生被看见
- **导师制**：每位教师负责 8–10 名学生的学业与成长指导
- **科创教育**：建设有机器人实验室、创客空间与生物组培室
- **体艺并举**：18 个学生社团，每年举办艺术节与体育节

## 校园环境

学校占地 86 亩，绿化覆盖率超过 40%。建有教学楼 3 栋、实验楼 1 栋、图书馆（藏书 12 万册）、体育馆、标准田径场与师生食堂。

## 荣誉

- 全国青少年科技创新大赛优秀组织单位
- 省级文明校园
- 市级教育教学质量先进单位（连续 8 年）

## 联系我们

- 地址：某某市某某区某某路 1 号
- 电话：010-0000 0000
- 邮箱：office@example.edu.cn`,
  },
  {
    title: '联系方式',
    slug: 'contact',
    sort: 2,
    content: `## 到校路线

**地址**：某某市某某区某某路 1 号

**公交**：乘坐 12 路、38 路、105 路至"明德中学站"下车，步行约 200 米。

**地铁**：地铁 4 号线"教育园区站"B 口出，向东步行 800 米。

## 联系方式

| 部门 | 电话 | 邮箱 |
| --- | --- | --- |
| 校办公室 | 010-0000 0000 | office@example.edu.cn |
| 教务处 | 010-0000 0001 | academic@example.edu.cn |
| 德育处 | 010-0000 0002 | moral@example.edu.cn |
| 招生咨询 | 010-0000 0003 | admission@example.edu.cn |

## 办公时间

周一至周五 08:00 – 17:00（法定节假日除外）

## 意见反馈

如您对学校工作有任何意见或建议，欢迎通过下方留言表单提交，我们将及时处理并回复。`,
  },
  {
    title: '招生信息',
    slug: 'admission-info',
    sort: 3,
    content: `## 招生计划

2026年秋季学期，我校计划招收高一新生 **480 名**，共 10 个教学班（其中实验班 2 个）。

## 招生范围

面向本区及周边区域招收符合条件的应届初中毕业生。

## 报名流程

1. **网上报名**：登录市教育局统一招生平台填报志愿
2. **材料提交**：户口本、学籍证明、综合素质评价材料
3. **录取通知**：按市教育局统一安排公布录取结果
4. **入学报到**：凭录取通知书按时到校报到

## 实验班选拔

实验班面向数理基础扎实、有学科特长的学生，入学后组织选拔测试，测试科目为数学与物理。

## 奖学金政策

学校设立"明德奖学金"，对中考成绩优异者给予一次性奖励，具体标准详见《新生入学手册》。

## 咨询方式

- 招生热线：010-0000 0003
- 邮箱：admission@example.edu.cn
- 校园开放日：每年 3 月中旬（具体日期见网站公告）`,
  },
  {
    title: '师资队伍',
    slug: 'faculty',
    sort: 4,
    content: `## 队伍概况

学校现有教职工 186 人，其中专任教师 162 人。

| 职称结构 | 人数 |
| --- | --- |
| 正高级教师 | 6 |
| 高级教师 | 58 |
| 一级教师 | 72 |
| 二级教师 | 26 |

## 学历结构

- 硕士研究生及以上：64 人（占 39.5%）
- 本科：98 人

## 名师风采

### 语文教研组

教研组现有教师 24 人，其中市级学科带头人 3 人。近年来在省级以上刊物发表论文 40 余篇。

### 数学教研组

数学组以"问题驱动"教学法著称，指导学生在全国高中数学联赛中累计获得省级一等奖 27 人次。

### 科技创新指导团队

由物理、化学、生物、信息技术四个学科教师组成，指导学生完成科创项目 60 余项。

## 教师发展

学校每年投入专项经费支持教师培训，与师范大学建立长期合作关系，定期选派骨干教师参与高校研修。`,
  },
]

/* ------------------------------------------------------------------ */
/* 写入                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  console.log('→ 正在写入示例数据…\n')

  /* 1. 管理员 ---------------------------------------------------- */
  // 仅在没有任何管理员时创建，绝不覆盖已修改过的密码
  const existingAdmins = await sql`select id from admins limit 1`
  if (existingAdmins.length === 0) {
    const hash = await bcrypt.hash('admin123', 10)
    await sql`
      insert into admins (username, password_hash, display_name, must_change_password)
      values ('admin', ${hash}, '管理员', true)
    `
    console.log('  ✓ 管理员账号 admin / admin123（首次登录后请立即修改密码）')
  } else {
    console.log('  · 管理员已存在，跳过创建')
  }

  /* 2. 分类 ------------------------------------------------------ */
  const categoryIds = new Map<string, number>()
  for (const cat of CATEGORIES) {
    const rows = await sql`
      insert into categories (name, slug, description, color, sort_order)
      values (${cat.name}, ${cat.slug}, ${cat.description}, ${cat.color}, ${cat.sort})
      on conflict (slug) do update set
        name = excluded.name,
        description = excluded.description,
        color = excluded.color,
        sort_order = excluded.sort_order
      returning id
    `
    categoryIds.set(cat.slug, rows[0].id as number)
  }
  console.log(`  ✓ 分类 ${CATEGORIES.length} 个`)

  /* 3. 文章 ------------------------------------------------------ */
  let articleCount = 0
  for (const article of ARTICLES) {
    const existing = await sql`select id from articles where slug = ${article.slug} limit 1`
    if (existing.length > 0) continue

    const publishedAt = new Date(Date.now() - article.daysAgo * 86_400_000)
    await sql`
      insert into articles
        (title, slug, content, excerpt, cover_image, category_id, status, featured, views, author, published_at)
      values (
        ${article.title}, ${article.slug}, ${article.content}, ${article.excerpt},
        ${article.cover}, ${categoryIds.get(article.category) ?? null}, 'published',
        ${article.featured}, ${article.views}, ${article.author}, ${publishedAt}
      )
    `
    articleCount++
  }
  console.log(`  ✓ 文章 ${articleCount} 篇${articleCount < ARTICLES.length ? `（另有 ${ARTICLES.length - articleCount} 篇已存在，跳过）` : ''}`)

  /* 4. 公告 ------------------------------------------------------ */
  let announcementCount = 0
  for (const item of ANNOUNCEMENTS) {
    const existing = await sql`select id from announcements where title = ${item.title} limit 1`
    if (existing.length > 0) continue

    await sql`
      insert into announcements (title, content, level, status, pinned, starts_at)
      values (
        ${item.title}, ${item.content}, ${item.level}, 'published', ${item.pinned},
        ${new Date(Date.now() - item.daysAgo * 86_400_000)}
      )
    `
    announcementCount++
  }
  console.log(`  ✓ 公告 ${announcementCount} 条`)

  /* 5. 单页 ------------------------------------------------------ */
  let pageCount = 0
  for (const page of PAGES) {
    const existing = await sql`select id from pages where slug = ${page.slug} limit 1`
    if (existing.length > 0) continue

    await sql`
      insert into pages (title, slug, content, status, show_in_nav, sort_order)
      values (${page.title}, ${page.slug}, ${page.content}, 'published', true, ${page.sort})
    `
    pageCount++
  }
  console.log(`  ✓ 单页 ${pageCount} 个`)

  /* 6. 站点设置 -------------------------------------------------- */
  const existingSettings = await sql`select key from settings where key = 'site' limit 1`
  if (existingSettings.length === 0) {
    const settings = {
      siteName: '明德中学',
      siteTagline: '明德笃学 · 知行合一',
      siteDescription: '明德中学官方网站，发布校园新闻、通知公告与教学动态。',
      logoText: '明德',
      faviconUrl: null,
      contactEmail: 'office@example.edu.cn',
      contactPhone: '010-0000 0000',
      contactAddress: '某某市某某区某某路 1 号',
      footerText: '© 明德中学 · 保留所有权利',
      icpBeian: '',
      showAnnouncementBar: true,
      showFeaturedArticles: true,
      featuredCount: 3,
      showCategories: true,
      showPages: true,
      theme: {
        preset: 'academic-blue',
        primary: '#2563eb',
        primaryForeground: '#ffffff',
        accent: '#0ea5e9',
        background: '#f8fafc',
        surface: '#ffffff',
        foreground: '#0f172a',
        muted: '#64748b',
        border: '#e2e8f0',
        radius: 'medium',
        fontFamily: 'system',
        containerWidth: 'normal',
        colorMode: 'light',
      },
      socialLinks: [],
    }
    await sql`insert into settings (key, value) values ('site', ${sql.json(settings)})`
    console.log('  ✓ 站点设置（默认"学院蓝"主题）')
  } else {
    console.log('  · 站点设置已存在，跳过')
  }

  console.log('\n✅ 示例数据写入完成。\n')
  console.log('   前台： http://localhost:5173')
  console.log('   后台： http://localhost:5173/admin')
  console.log('   密码： admin123\n')
}

main()
  .catch((error) => {
    console.error('\n❌ 写入失败：', error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(() => sql.end())
