---
slug: 36-yaksh-diptesh-gandhi
title: SCOUT
students:
  - Yaksh Gandhi
tags:
  - rag
  - electron
  - local-first
  - llm
category: other
tagline: A local-first desktop knowledge assistant for document-grounded AI Q&A.
featuredEligible: true
semester: "Spring 2026"
shortTitle: "SCOUT"
studentId: "116932822"
videoUrl: "https://drive.google.com/file/d/1ET6lMdRsIByUXpFnxcuHAA6-V56z9E4w/view?usp=sharing"
thumbnail: "https://drive.google.com/file/d/1ts2EZMegIVVkiFKq6rgRGt7ZZjCAd530/view?usp=sharing"
githubUrl: "https://github.com/yaksh1/SCOUT"
---

## Problem

Many document-Q&A tools are cloud-dependent, hard to customize with personal model providers, or require Docker-heavy setup that slows down onboarding for students and independent learners.

## Solution

SCOUT is a local-first Electron application that lets users import documents, build a knowledge base, and chat with grounded responses using RAG. It supports multiple model providers (including OpenAI-compatible endpoints and local setups), keeps data local, and removes the need for server deployment to get started.

## User Flow

- Create a notebook and import sources (PDF, DOCX, PPTX, URL, or text)
- SCOUT parses content, chunks it, and generates embeddings for vector retrieval
- Ask questions in chat and receive context-grounded answers with source traceability
- Generate structured outputs like notes, quizzes, and mind maps for study workflows

## LLM Components

- **RAG retrieval pipeline** - converts source documents into chunks and embeddings for semantic search
- **Provider abstraction layer** - supports switching between multiple LLM/embedding providers
- **Prompted generation workflows** - powers note creation, quiz generation, and mind map generation from notebook context

## Tools

- **Desktop App:** Electron
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Database:** SQLite, Drizzle ORM
- **Vector Search:** sqlite-vec
- **Document Parsing:** pdfjs-dist, mammoth, officeparser

