import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { TestLogger } from '../helpers';

describe('Bill Mei Conversation Test', () => {
    it('should format complex thread conversation without Unknown Users', () => {
        const userMap = {
            "U01SNKQFY68": "Bill Mei",
            "U06BMM460E5": "Raghav Jhavar",
            "U077CBH034L": "Stas Khalup",
            "UT8GE12R4": "Stathis Vafeias",
            "U024TQNRL73": "Chris Bala",
            "UAY01H2TW": "Cameron Bernhardt",
            "US7TDC9MG": "Michael Mejia",
            "U02RTE4DTSQ": "Eduardo Moreno"
        };
        
        const emojiMap = JSON.parse(DEFAULT_SETTINGS.emojiMapJson || '{}');
        const formatter = new SlackFormatter(DEFAULT_SETTINGS, userMap, emojiMap);
        
        const input = `Bill MeiBill Mei![:connect-fingerguns:](https://slack-imgs.com/?c=1&o1=gu&url=https%3A%2F%2Femoji.slack-edge.com%2FT0181S17H6Z%2Fconnect-fingerguns%2Ff9fe509facc6b358.png)  [Monday at 4:28 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750105691887189)  

What's the current meta right now for which model to pick for the job? Here's my take:General purpose queries:  

- o3

Coding:  

- Sonnet 4 or Gemini 2.5 Pro

Research or analysis:  

- o3-pro

Images:  

- GPT-4o

Cheapest:  

- Haiku 3.5

Do not use:  

- GPT-4.1 series
- o4-mini
- o1 series

![:subscribe:](https://emoji.slack-edge.com/T0181S17H6Z/subscribe/d07a383520fa6991.png)4![:heavy_plus_sign:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-small/2795@2x.png)1

17 replies

---

![](https://ca.slack-edge.com/E0181S17H6Z-U01SNKQFY68-a076510e80d8-48)

Bill MeiBill Mei![:connect-fingerguns:](https://slack-imgs.com/?c=1&o1=gu&url=https%3A%2F%2Femoji.slack-edge.com%2FT0181S17H6Z%2Fconnect-fingerguns%2Ff9fe509facc6b358.png)  [Monday at 4:30 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750105812739059?thread_ts=1750105691.887189&cid=C053MUD1RK2)  

I think "General purpose" used to be either Sonnet 3.7 or GPT-4o, but with the recent 80% price reduction in o3, it now makes sense to use o3 for general purpose stuff as it's cost comparable to both Sonnet and GPT-4o

![](https://ca.slack-edge.com/E0181S17H6Z-U06BMM460E5-12fe0bee488f-48)

Raghav JhavarRaghav Jhavar  [Monday at 4:30 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750105848663049?thread_ts=1750105691.887189&cid=C053MUD1RK2)  

Why's GPT-4.1 do not use? ![:open_mouth:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-medium/1f62e@2x.png)

![](https://ca.slack-edge.com/E0181S17H6Z-U01SNKQFY68-a076510e80d8-48)

Bill MeiBill Mei![:connect-fingerguns:](https://slack-imgs.com/?c=1&o1=gu&url=https%3A%2F%2Femoji.slack-edge.com%2FT0181S17H6Z%2Fconnect-fingerguns%2Ff9fe509facc6b358.png)  [Monday at 4:31 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750105876342079?thread_ts=1750105691.887189&cid=C053MUD1RK2)  

I think o3 is strictly better than GPT-4.1 on all dimensions, especially now that they cost the same (edited) 

![:heavy_plus_sign:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-small/2795@2x.png)1

![](https://ca.slack-edge.com/E0181S17H6Z-U06BMM460E5-12fe0bee488f-48)

Raghav JhavarRaghav Jhavar  [Monday at 4:31 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750105888911109?thread_ts=1750105691.887189&cid=C053MUD1RK2)  

Gotcha

![](https://ca.slack-edge.com/E0181S17H6Z-U077CBH034L-86042b0bb566-48)

Stas KhalupStas Khalup  [Monday at 4:31 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750105896880229?thread_ts=1750105691.887189&cid=C053MUD1RK2)  

I still find that O1 has the best in class context adherence, so when I do any categorization on the massive input kind of task and want reality checks against the data I prefer to wait for 30 secs for it to produce results

![](https://ca.slack-edge.com/E0181S17H6Z-U01SNKQFY68-a076510e80d8-48)

Bill MeiBill Mei![:connect-fingerguns:](https://slack-imgs.com/?c=1&o1=gu&url=https%3A%2F%2Femoji.slack-edge.com%2FT0181S17H6Z%2Fconnect-fingerguns%2Ff9fe509facc6b358.png)  [Monday at 4:32 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750105937184879?thread_ts=1750105691.887189&cid=C053MUD1RK2)  

yeah I'm assuming this is not for giant contexts, in that case you want one of the large context window models ![:smile:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-medium/1f604@2x.png)

![](https://ca.slack-edge.com/E0181S17H6Z-U077CBH034L-86042b0bb566-48)

Stas KhalupStas Khalup  [Monday at 4:34 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750106046300079?thread_ts=1750105691.887189&cid=C053MUD1RK2)  

On paper Gemini would have a larger input context capabilities but I find adherence poor especially since the deprecation of the magic 05-23 checkpoint

![:til2:](https://emoji.slack-edge.com/T0181S17H6Z/til2/4d72f876d823055d.png)1

![](https://ca.slack-edge.com/E0181S17H6Z-UT8GE12R4-254f1fae1f8f-48)

Stathis VafeiasStathis Vafeias  [Monday at 4:43 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750106630302669?thread_ts=1750105691.887189&cid=C053MUD1RK2)  

I'll come in ![:spicy:](https://emoji.slack-edge.com/T0181S17H6Z/spicy/d12ed9157bbc6586.png)  gpt o3 > claude at coding

![](https://ca.slack-edge.com/E0181S17H6Z-U024TQNRL73-897c23fc3d5c-48)

Chris BalaChris Bala  [Monday at 5:03 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750107809601319?thread_ts=1750105691.887189&cid=C053MUD1RK2)  

gpt-4o-mini is so much cheaper than Haiku 3.5 though, and still good for some thingsI have found gpt-4.1-nano to be not *quite* as good, so I am preferring 4o-mini for the cheap tasks

![:heavy_plus_sign:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-small/2795@2x.png)1

[5:04](https://stripe.slack.com/archives/C053MUD1RK2/p1750107870968349?thread_ts=1750105691.887189&cid=C053MUD1RK2)

I am using these for high volume programatic API usage, so price matters a lot

![](https://ca.slack-edge.com/E0181S17H6Z-UAY01H2TW-02e4ce16d53f-48)

Cameron BernhardtCameron Bernhardt![:no_entry:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/26d4.png)  [Monday at 5:11 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750108314814479?thread_ts=1750105691.887189&cid=C053MUD1RK2)  

i've found o4-mini to be very good at tool calling with toolshed in cursor

[5:12](https://stripe.slack.com/archives/C053MUD1RK2/p1750108337466889?thread_ts=1750105691.887189&cid=C053MUD1RK2)

leagues better than any of the others in this list which are very reluctant to call tools for some reason

![](https://ca.slack-edge.com/E0181S17H6Z-US7TDC9MG-6e4b29f63438-48)

Michael MejiaMichael Mejia![:face_with_thermometer:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/1f912.png)  [Monday at 6:31 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750113061176819?thread_ts=1750105691.887189&cid=C053MUD1RK2)  

[@billmei](https://stripe.slack.com/team/U01SNKQFY68) For GPT-4o -- Is there an interface for us internally for image generation? I found image capabilities at go/gemini quite limiting, and go/llm doesn't support image generation.

![:shakey:](https://emoji.slack-edge.com/T0181S17H6Z/shakey/faf565b57c5e128a.gif)2

![](https://ca.slack-edge.com/E0181S17H6Z-U02RTE4DTSQ-228409bb779e-48)

Eduardo MorenoEduardo Moreno  [Tuesday at 2:09 AM](https://stripe.slack.com/archives/C053MUD1RK2/p1750140598060229?thread_ts=1750105691.887189&cid=C053MUD1RK2)  

For me:Gemini 2.5 Pro for most things, unless I need significant time to be spent on reasoning or I want a quick answer.o3 for anything that needs significant reasoning lift. I find that o3 does a better job at reasoning than 2.5 Pro, but we'll see what happens once 2.5 Deep Think becomes available.GPT 4o for simple fact-based queries, but I've actually been using Gemini 2.5 Flash more and more for this just because Gemini is easy to activate on an Android and it uses Flash if activated as the assistant.For in-depth research, I basically default to Gemini Deep Research with 2.5 Pro. For more surface-level research (but still better than 4o with web search), I tend to use o3 with web search. ChatGPT Deep Research is great, but its output is overly wordy; I feel like its trying to impress me.

![](https://ca.slack-edge.com/E0181S17H6Z-U01SNKQFY68-a076510e80d8-48)

Bill MeiBill Mei![:connect-fingerguns:](https://slack-imgs.com/?c=1&o1=gu&url=https%3A%2F%2Femoji.slack-edge.com%2FT0181S17H6Z%2Fconnect-fingerguns%2Ff9fe509facc6b358.png)  [Tuesday at 10:10 AM](https://stripe.slack.com/archives/C053MUD1RK2/p1750169416384109?thread_ts=1750105691.887189&cid=C053MUD1RK2)  

I didn't expect Gemini to be so popular! To be fair I haven't played around with it as much except for with the deep research tool

![](https://ca.slack-edge.com/E0181S17H6Z-U077CBH034L-86042b0bb566-48)

Stas KhalupStas Khalup  [Tuesday at 11:36 AM](https://stripe.slack.com/archives/C053MUD1RK2/p1750174571531469?thread_ts=1750105691.887189&cid=C053MUD1RK2)  

> I didn't expect Gemini to be so popular! To be fair I haven't played around with it as much except for with the deep research tool

They've release 5-23 preview in May and it was magical. While it was available I felt that the future is finally here for the first time but it seems that it was: too expensive to run, exposed COT directly so others could use it to train their models. They've quickly pulled it back and replaced it with 06-05 checkpoint which was nothing like 05-23. Now they say that they are slowly fixing "some" regressions

![bufo-thumbsup](https://slack-imgs.com/?c=1&o1=gu&url=https%3A%2F%2Femoji.slack-edge.com%2FT0181S17H6Z%2Fbufo-thumbsup%2F10dc6775c6f8e350.png)![bufo-ty](https://slack-imgs.com/?c=1&o1=gu&url=https%3A%2F%2Femoji.slack-edge.com%2FT0181S17H6Z%2Fbufo-ty%2Fa4e226ec281b39ba.png)![bufo-ack](https://slack-imgs.com/?c=1&o1=gu&url=https%3A%2F%2Femoji.slack-edge.com%2FT0181S17H6Z%2Fbufo-ack%2F25c9a5e40b69cd48.png)

![](https://ca.slack-edge.com/E0181S17H6Z-U02RTE4DTSQ-228409bb779e-48)

Eduardo MorenoEduardo Moreno  [Tuesday at 12:13 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750176814317089?thread_ts=1750105691.887189&cid=C053MUD1RK2)  

ugh, the move away from raw reasoning traces is such a problem, particularly in highly regulated use cases like fincrimes. ![:disappointed:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-medium/1f61e@2x.png) Gemini 2.5's original traces were _perfect_. I wish those were an option in the API, even if it were gated behind something like user EDD to make sure you don't have the DeepSeeks of the world using them to train their own models.`;

        const result = formatter.formatSlackContent(input);
        
        // Check for Unknown User messages
        const unknownUserCount = (result.match(/\[\[Unknown User\]\]/g) || []).length;
        TestLogger.log('Unknown User count:', unknownUserCount);
        
        // Extract message blocks
        const messageBlocks = result.match(/> \[!slack\]\+ Message from ([^\n]+)/g) || [];
        TestLogger.log('Total message blocks found:', messageBlocks.length);
        TestLogger.log('Message authors:', messageBlocks.map(b => b.replace(/> \[!slack\]\+ Message from /, '')));
        
        // Check for specific content
        TestLogger.log('Contains "current meta":', result.includes('current meta'));
        TestLogger.log('Contains bullet points:', result.includes('- o3'));
        // Note: Thread metadata like "17 replies" is not preserved in the output
        
        // Verify no Unknown Users
        expect(unknownUserCount).toBe(0);
        
        // Verify all users are properly identified
        expect(messageBlocks.length).toBeGreaterThanOrEqual(8); // At least 8 different people in thread
        
        // Verify specific users
        expect(result).toContain('Bill Mei');
        expect(result).toContain('Raghav Jhavar');
        expect(result).toContain('Eduardo Moreno');
        
        // Verify content preservation
        expect(result).toContain('current meta');
        expect(result).toContain('- o3');
        expect(result).toContain('- Sonnet 4 or Gemini 2.5 Pro');
        
        // Show first few lines of output for debugging
        TestLogger.log('\n=== First few lines of output ===');
        const lines = result.split('\n').slice(0, 20);
        TestLogger.log(lines.join('\n'));
    });
});