---
title: 마크다운 문법 모아보기
date: 2026-10-22
tags: [마크다운, 테스트]
description: 지원하는 모든 문법을 한 번에 확인하는 샘플 글입니다.
---

## 코드

인라인 코드는 `const a = 1;` 처럼 씁니다. 코드 블록은 아래와 같습니다.

```js
function greet(name) {
  return `Hello, ${name}! <b>escaped</b>`;
}
console.log(greet('blog'));
```

## 표

| 이름 | 역할 | 비고 |
| :--- | :---: | ---: |
| markdown.js | 파서 | 의존성 없음 |
| build.js | 빌드 | Node 내장 모듈만 사용 |

## 목록

- 첫 번째 항목
- 두 번째 항목
- 세 번째 항목

## 이스케이프 확인

<script>alert('xss')</script> 가 그대로 글자로 보여야 합니다. [위험한 링크](javascript:alert(1))는 무력화됩니다.

---

아주아주긴문자열아주아주긴문자열아주아주긴문자열아주아주긴문자열아주아주긴문자열아주아주긴문자열아주아주긴문자열아주아주긴문자열도 화면 밖으로 넘치지 않아야 합니다.
