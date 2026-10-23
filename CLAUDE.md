# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

마크다운 글을 정적 블로그 사이트로 변환하는 프로젝트. 프레임워크·번들러·외부 의존성 없이 순수 HTML/CSS/JS와 Node 내장 모듈만 쓴다 (`package.json` 없음, 린트·테스트 설정 없음). 새 의존성은 도입 전에 사용자에게 확인한다.

## 명령어
```bash
node scripts/build.js                 # posts/*.md → dist/ 생성
python -m http.server -d dist 8765    # 로컬 확인 (file://로 열어도 동작: 모든 경로가 상대 경로)
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
