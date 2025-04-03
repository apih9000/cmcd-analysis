## CMCD
Common Media Client Data (CMCD) is a standard that enables media clients to communicate performance and playback metrics to media servers. This information helps servers monitor delivery using client-side metrics.
The most important thing is that now client-side metrics are finally available on the server-side, which complement monitoring and help to optimize delivery.

Docs: Official CMCD specification PDF [link](https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf). And a video explanation "What is CMCD" is on Youtube [link](https://www.youtube.com/watch?v=sWuQ3RZ6R5w&list=PLVztGGxiGfIhBmyFhixteZKJvWC3KlaSf&index=5).

The most common example of identifying user issues is measuring "response_time" from CDN logs. 
But this value often doesn't show the real picture: 
- if the cache buffer is 2 seconds long, and the next chunk arrives with a 0.5 second delay, then...
- as you can imagine, nothing will happen on client-side at all. This is exactly what client metrics show.

## This demo 
This demo shows what exactly the player is sending to the server and how the server can respond to them. CMCD data is taked from the local player on the page!

<img src="https://github.com/apih9000/cmcd-analysis/blob/main/screenshots/cmcd-analysis.jpg?raw=true" width="200px" />

## Live demo
Live demo is available here – [https://codepen.io/apih9000/pen/XJWOYZW](https://codepen.io/apih9000/pen/XJWOYZW) 

## CMCD Parameters
Some interesting parameters to start from (full list you can see in the official documentation):
- bl (Buffer Length).  Current buffer length of the media being played	milliseconds. To detect how often buufer is emptied. 
- br (Encoded Bitrate)	Encoded bitrate of the current segment	bits per second
- bs (Buffer State)	Current state of the buffer	enum (0 = stable, 1 = growing, 2 = shrinking)
- cid (Content ID)	Unique identifier for the content being played	string
- nrr (Next Request Range)	Range of the next segment to be requested	bytes
- ot (Object Type)	Type of object being requested	enum (v = video, a = audio, av = audio+video, etc)
- pr (Playback Rate)	Current playback rate relative to normal speed	ratio (1.0 = normal)
- sid (Session ID)	Unique identifier for the playback session	string
- su (Startup)	Indicates if the request is for startup	boolean
- tb (Throughput)	Target bitrate for the next segment	bits per second
