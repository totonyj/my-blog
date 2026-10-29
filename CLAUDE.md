# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

마크다운 글을 정적 블로그 사이트로 변환하는 프로젝트. 블로그 본체는 프레임워크·번들러 없이 순수 HTML/CSS/JS와 Node 내장 모듈만 쓴다 (`package.json` 없음, 린트·테스트 설정 없음). 블로그에는 `apps/` 아래에 독립 웹앱도 추가한다 (아래 "웹앱 개발 워크플로" 참고).

## 명령어
```bash
node scripts/build.js                 # posts/*.md → dist/ 생성
python -m http.server -d dist 8765    # 로컬 확인 (글 페이지는 file://로도 열리지만, ES module을 쓰는 웹앱은 서버로 열어야 함)
```
- 빌드 후 `dist/`를 직접 편집하지 않는다 (매번 내용이 비워지고 재생성됨).
- Windows에서 서버가 `dist/`를 잡고 있어도 빌드가 되도록 `build.js`는 폴더 자체가 아닌 내용만 지운다. 이 동작을 `rm(DIST)`로 되돌리지 말 것.

## 아키텍처
빌드 파이프라인: `posts/*.md` → `scripts/markdown.js`(파싱·변환) → `scripts/build.js`(템플릿 조립) → `dist/`.

- **`scripts/markdown.js`**: 직접 만든 변환기. `parseFrontMatter`(단순 `key: value`, `[a, b]` 배열만 지원), `renderMarkdown`(블록 단위 line parser + 인라인 정규식). 모든 텍스트는 `escapeHtml`을 거치고 링크/이미지 URL은 `safeUrl`로 `javascript:` 등을 `#`으로 치환한다. 이 두 가지 보안 처리를 우회하는 변경을 하지 말 것. 중첩 목록은 미지원.
- **`scripts/build.js`**: 슬러그는 파일명에서 `YYYY-MM-DD-` 접두어를 뗀 값(`2026-10-20-hello-blog.md` → `hello-blog`). 정렬은 front matter `date` 문자열 내림차순. 목록/글 본문 HTML 조각은 이 파일 안의 함수(`indexContent`, `postContent`)가 만들고, 공통 틀만 `src/templates/layout.html`의 `{{placeholder}}`로 채운다.
- **경로 규칙**: 레이아웃의 `{{root}}`가 CSS/JS/홈 링크 기준이다. 홈은 `./`, 글 페이지(`dist/posts/<slug>/index.html`)는 `../../`. 페이지 깊이를 바꾸면 `root`도 같이 바꿔야 한다. 이전/다음 글 링크는 `../<slug>/index.html`.
- **테마**: `layout.html`의 `<head>` 인라인 스크립트가 `localStorage.theme`을 첫 페인트 전에 `<html data-theme>`로 적용(FOUC 방지), `src/js/theme.js`는 토글만 담당. CSS는 `:root`(라이트) / `[data-theme="dark"]` / `prefers-color-scheme` 세 곳에 다크 변수가 중복 정의되어 있으므로 색을 바꿀 때 세 군데를 함께 수정한다. 아이콘 표시도 같은 세 조건으로 분기한다.

## 글 작성 형식
`posts/YYYY-MM-DD-slug.md`, 상단 front matter:
```
---
title: 제목
date: 2026-10-20
tags: [태그1, 태그2]
description: 목록에 보일 한 줄 요약
---
```
파일명 날짜가 아니라 front matter의 `date`가 정렬·표시에 쓰인다.

## CSS 주의점
- 한글 가독성 때문에 `body`에 `word-break: keep-all; overflow-wrap: anywhere`를 쓴다. 코드 블록과 표는 이를 덮어써서(`normal`) 글자 단위로 끊기지 않게 하고, 표는 `.table-wrap`에서 가로 스크롤한다.
- 색·간격·폰트는 `:root` CSS 변수만 사용하고 하드코딩하지 않는다.
- 모바일 우선, 확인 너비는 360 / 768 / 1280px. 터치 대상은 최소 44px.

## 웹앱 개발 워크플로
블로그에 웹앱을 추가할 때는 **plan → build → review → embed** 순서로 진행한다. 단계를 건너뛰거나 순서를 바꾸지 않는다.

### 승인 규칙 (최우선)
- **사용자 승인 없이 구현하지 않는다.** plan 결과를 사용자에게 보여 주고 명시적으로 승인받기 전에는 build 단계로 넘어가지 않는다.
- 각 단계가 끝날 때마다 결과를 보고하고, 다음 단계 진행 전 승인을 받는다. 승인은 단계별이며 다른 단계·다른 앱으로 이어지지 않는다.
- **막히는 부분은 추측으로 진행하지 말고 즉시 사용자에게 알린다.** 요구사항이 모호하거나, 결정이 필요하거나, 서브에이전트가 실패·보고 불가한 경우가 모두 해당한다.

### 단계
| 단계 | 하는 일 | 산출물 |
| :--- | :--- | :--- |
| plan | 앱 목적, 기능 범위, 화면 구성, 파일 구조, 사용할 라이브러리/CDN, 모바일 대응 방안을 설계 | 계획서 (사용자 승인 필요) |
| build | 승인된 계획대로 `apps/{앱이름}/`에 구현 | 동작하는 앱 |
| review | 계획 대비 누락, 버그, 모바일·다크모드·접근성, 라이브러리 사용 규칙 준수 여부 점검 | 리뷰 보고서 (문제는 사용자에게 보고) |
| embed | 블로그에 연결: 홈/글에서의 링크, `scripts/build.js`가 `apps/`를 `dist/apps/`로 복사하도록 반영, 로컬 빌드 확인 | 블로그에서 접근 가능한 앱 |

embed는 `build.js` 등 기존 블로그 코드를 수정하므로 변경 내용을 먼저 보여 주고 승인받는다. 커밋과 배포(push, gh-pages)는 사용자가 요청할 때만 한다.

### 서브에이전트와 지침 파일
- 각 단계는 서브에이전트에게 맡길 수 있고, 맡길 때는 **프롬프트에 길게 적지 않고 단계 전용 지침 파일(.md)을 만들어 그 경로를 전달**한다.
- 지침 파일 위치: `.claude/briefs/{앱이름}-{단계}.md` (예: `.claude/briefs/todo-build.md`). 앱 폴더(`apps/`) 안에는 두지 않는다 (사이트에 배포되므로).
- 지침 파일에 반드시 포함할 것: 목표, 입력(앞 단계 산출물·승인된 계획 경로), 작업 범위와 수정 가능한 파일/폴더, 이 문서의 개발 규칙(아래), 완료 조건, 보고 형식, "막히면 추측하지 말고 보고할 것".
- 서브에이전트는 `apps/{앱이름}/` 밖의 파일을 수정하지 않는다. 예외는 embed 단계에서 승인받은 블로그 파일뿐이다.
- 서브에이전트의 보고는 그대로 믿지 말고 결과물(파일, 동작)을 직접 확인한 뒤 사용자에게 전달한다.

### 폴더 구조
- 모든 웹앱은 `apps/{앱이름}/` 안에 둔다. 앱 이름은 소문자-하이픈(kebab-case).
- 각 앱은 독립적이다: 진입점은 `apps/{앱이름}/index.html`, 앱 전용 CSS/JS도 같은 폴더에 둔다. 블로그 `src/`의 파일을 직접 수정하거나 다른 앱의 파일을 참조하지 않는다.
- 모든 경로는 상대 경로로 쓴다 (하위 경로 배포에서 동작해야 함). `<script type="module">`은 `file://` 더블클릭으로는 브라우저가 막으므로, 모듈을 쓰는 앱은 로컬 서버나 배포 주소에서만 동작한다 (허용된 제약).
- 빌드 시 `scripts/build.js`가 `apps/`를 `dist/apps/`로 통째로 복사하고, 각 `apps/*/index.html`의 `<title>`과 `<meta name="description">`을 읽어 홈의 "웹앱" 목록(글 목록 아래)을 만든다. 따라서 모든 앱의 `index.html`에는 이 두 가지가 있어야 하고, 앱에는 블로그로 돌아가는 링크(`../../index.html`)를 둔다.

### 개발 규칙
- **외부 라이브러리는 최소화**한다. 순수 JS로 충분하면 쓰지 않는다. 꼭 필요하면 plan 단계에서 이유와 함께 명시해 승인받는다.
- **CDN은 허용**한다. 단, 버전을 고정한 URL만 쓰고(`@latest` 금지), plan에 사용한 CDN 목록을 적는다. `npm`/`package.json` 도입이 필요하면 먼저 사용자에게 확인한다.
- **모바일에서 잘 보여야 한다.** 모바일 우선으로 작성하고 `viewport` 메타 태그 필수, 가로 스크롤 금지, 터치 대상 최소 44px. 360 / 768 / 1280px에서 확인한다.
- 블로그의 다크모드를 따른다: 앱도 `prefers-color-scheme`과 `<html data-theme>`(localStorage `theme`)에서 색을 맞추고, 색은 CSS 변수로 정의한다.
- 사용자 입력을 HTML로 넣을 때는 `textContent` 또는 이스케이프를 쓴다 (`innerHTML`에 입력값 직접 삽입 금지).
- 앱 데이터를 저장해야 하면 `localStorage` 사용을 기본으로 하고, 서버·외부 API·계정이 필요한 기능은 plan 단계에서 사용자에게 먼저 확인한다.
