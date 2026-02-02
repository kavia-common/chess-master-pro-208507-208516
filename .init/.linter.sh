#!/bin/bash
cd /home/kavia/workspace/code-generation/chess-master-pro-208507-208516/chess_backend
npm run lint
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -ne 0 ]; then
  exit 1
fi

