#include <iostream>
#include <SDL2/SDL.h>
#include "obsticale.h"


obsticale::obsticale()
{
    spawncord();
}

obsticale::~obsticale()
{
    //dtor
}

void obsticale::render(SDL_Renderer* rend, SDL_Texture* obsttxt)
 {
    if(visible == 1)
    {
        SDL_Rect obstrect; obstrect.w = w; obstrect.h = h; obstrect.x = x; obstrect.y = y;
        SDL_RenderCopy(rend, obsttxt, NULL, &obstrect);
    }

 }



bool obsticale::colplayer(SDL_Rect playr)
{
    SDL_Rect obstrect;
    obstrect.w = w; obstrect.h = h; obstrect.x = x; obstrect.y = y;

    if (check_collision(obstrect, playr) == 1)
        return 1;
     else
        return 0;
}

void obsticale::spawncord()
{
    w = random(30, 80);
    h = w;
    do
    {
        x = random(0, 800 - w);
        y = random(0, 600 - w);
    }
    while(x > 500 - w && y < 110);
}


bool obsticale::check_collision( SDL_Rect A, SDL_Rect B )
{
//The sides of the rectangles
int leftA, leftB;
int rightA, rightB;
int topA, topB;
int bottomA, bottomB;

//Calculate the sides of rect A
leftA = A.x;
rightA = A.x + A.w;
topA = A.y;
bottomA = A.y + A.h;

//Calculate the sides of rect B
leftB = B.x;
rightB = B.x + B.w;
topB = B.y;
bottomB = B.y + B.h;

//If any of the sides from A are outside of B
if( bottomA <= topB )
{
    return false;
}

if( topA >= bottomB )
{
    return false;
}

if( rightA <= leftB )
{
    return false;
}

if( leftA >= rightB )
{
    return false;
}

//If none of the sides from A are outside B
return true;
}
