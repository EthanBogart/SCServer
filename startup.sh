#!/bin/bash
tmux new-session -d -s SC 'sudo node SCServer.js'
tmux detach -s SC
