> [!slack]+ Message from Owen Chandler
> **Time:** 6:28 PM
>
> We are trying to leverage the Gong integration to identify the longest monologue by a sales rep. The way Gong tracks longest monologue is inaccurate because even if a prospect coughs, it ends the monologue. We have tried for hours using a prompt to analyze the transcript to better identify longest monologue and it's still inaccurate (but much closer to gong). Does anyone have any suggestions/ideas on how we can achieve this? (prompt in thread) Owen Chandler

> [!slack]+ Message from Owen Chandler
> **Time:** 6:28 PM
>
> #CONTEXT# You're finding the rep's longest monologue in a transcript. A monologue only ends if the prospect speaks for ≥10 seconds. #OBJECTIVE# Analyze the call transcript and return the rep's longest uninterrupted monologue, following the specified rules. #INSTRUCTIONS# 1. Analyze the /f_0sxfv1exQCiSZErKsV5.transcript . 2. Clearly identify every segment of continuous rep speech. Continuous rep speech is broken only by prospect interruptions lasting 10 seconds or more. 3. For every prospect interruption that occurs between rep speech segments, explicitly identify: Interruption timestamp (start and end) Exact interruption duration in seconds 4. Calculate whether the interruption breaks (≥10 seconds) or does not break (<10 seconds) the monologue. If the monologue was ≥10 seconds, treat that as a break and start a new rep segment after the prospect finishes talking. If the monologue was not broken, ignore the interruption and continue counting the rep's monologue. 5. Repeat the process until the end of the call. 6. Identify and return the rep's longest monologue, including its duration in seconds. 7. Output only the monologue's duration in the specified format. #EXAMPLES# Input: Transcript with alternating rep and prospect turns, with some prospect turns under and some over 10 seconds. Expected Output: DurationSeconds: [120]

> [!slack]+ Message from Clay
> **Time:** 6:28 PM
>
> Hi there, thanks so much for sharing this! We'l be passing your feedback along to our product team, and any additional context you can provide will help us prioritize with your needs in mind as we shape the roadmap. If there are specific use cases, workflows, or challenges where these suggestions would make a big difference, feel free to share—we'd love to hear more. Otherwise, we'l plan to close this ticket soon and review your input offline.

> [!slack]+ Message from Jorge Macias
> **Time:** 12:12 PM
>
> easy, tell prospects to never cough on a call

> [!slack]+ Message from Clay
> **Time:** 12:13 PM
>
> All set, close this ticket out I want to chat with support

> [!slack]+ Message from Bo (clay)
> **Time:** 2:22 PM
>
> Hey, That's a tricky problem with analyzing speech patterns. A few ideas that might help improve accuracy: Try a different approach with the prompt: * Break it into steps: first identify all speaker segments with timestamps and extract them with Formula, then calculate durations, then apply the 10-seco… See more Have you tried testing it on a known transcript where you manually verified the longest monologue? Let me know if you have more questions.

> [!slack]+ Message from Channeled
> **Time:** 2:24 PM
>
> This thread was picked up by our in-app web widget and will no longer sync to Slack. If you are the original poster, you can continue this conversation by logging into https://app.clay.com (https://app.clay.com/) and clicking "Support" in the sidebar. If you're not the original poster and require help from support, please post in #02___support (https://clayrunhq.slack.com/archives/C025KSBLPGX).