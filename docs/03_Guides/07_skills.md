# Context7 Skill (Bash Version)

## search_memory
Upstash Vector DB에서 관련 맥락을 검색합니다.
- Usage: `mcp-porter run @upstash/context7-mcp --api-key $UPSTASH_API_KEY -- search_nodes --query "검색어"`

## save_memory
중요한 정보를 저장합니다.
- Usage: `mcp-porter run @upstash/context7-mcp --api-key $UPSTASH_API_KEY -- create_node --content "저장할 내용"`