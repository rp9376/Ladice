#include "friendly.h"
#include <iostream>
#include <SDL2/SDL.h>
#include <math.h>

friendly::friendly()
{
    respawncord();
}

friendly::~friendly()
{

}

void friendly::render(SDL_Renderer* rend, SDL_Texture* frietxt,  bool hax)
 {
    if(visible == 1 || hax)
    {
        SDL_Rect frierect; frierect.w = w; frierect.h = h; frierect.x = x; frierect.y = y;
        SDL_RenderCopy(rend, frietxt, NULL, &frierect);
    }
 }

bool friendly::colplayer(SDL_Rect playr)
{
    SDL_Rect frierect; frierect.w = w; frierect.h = h; frierect.x = x; frierect.y = y;
    movement();
    visible = ifvisible(playr, frierect,  visibility);
     if (check_collision(frierect, playr) == 1)
        {
            respawn = 1;
            return 1;
        }
     else
        return 0;
}

bool friendly::ifvisible(SDL_Rect playr, SDL_Rect frierect, int range)
{
    int
    px = playr.x - 25,
    py = playr.y - 25,
    ex = frierect.x - frierect.w/2,
    ey = frierect.y - frierect.w/2,
    rangex = abs(px - ex),
    rangey = abs(py - ey);
    if(sqrt(rangex * rangex + rangey * rangey) > range)
        return 0;
    else
        return 1;
}

bool friendly::check_collision( SDL_Rect A, SDL_Rect B )
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

void friendly::respawncord()
{
    if(respawn)
        {
            randmove();
            visible = 0;
            x = random(0, 800-50), y = random(0, 600-50);
            respawn = 0;
        }
}

void friendly::movement()
{       //1. gor 2. dol 3. levo 4. desno
    switch(smer)
    {
    case 1://gor
        if(y <= 0 || dist <= 0 || y - speed < 0)
            {
                randmove();
            }
        else
            {
                y-=speed;
                dist-=speed;
            }
        break;

    case 2: //dol
        if(y >= 550 || dist <= 0 || y + speed > 550)
            {
                randmove();
            }
        else
            {
                y+=speed;
                dist-=speed;
            }
        break;

    case 3: //levo
        if(x <= 0 || dist <= 0 || x - speed < 0)
            {
                randmove();
            }
        else
            {
                x-=speed;
                dist-=speed;
            }
        break;

    case 4: //desno
        if(x >= 750 || dist <= 0 || x + speed > 750)
            {
                randmove();
            }
        else
            {
                x+=speed;
                dist-=speed;
            }
        break;

    case 5: // gor levo
        if(y <= 0 || dist <= 0 || y - speed < 0 || x <= 0 || dist <= 0 || x - speed < 0)
            {
                randmove();
            }
        else
            {
                y-=speed;
                x-=speed;
                dist-=speed;
            }
        break;

    case 6: // gor desno
        if(y <= 0 || dist <= 0 || y - speed < 0 || x >= 750 || dist <= 0 || x + speed > 750)
            {
                randmove();
            }
        else
            {
                y-=speed;
                x+=speed;
                dist-=speed;
            }
        break;

    case 7: // dol levo
        if(y >= 550 || dist <= 0 || y + speed > 550 || x <= 0 || dist <= 0 || x - speed < 0)
            {
                randmove();
            }
        else
            {
                y+=speed;
                x-=speed;
                dist-=speed;
            }
        break;

    case 8: // dol desno
        if(y >= 550 || dist <= 0 || y + speed > 550 || x >= 750 || dist <= 0 || x + speed > 750)
            {
                randmove();
            }
        else
            {
                y+=speed;
                x+=speed;
                dist-=speed;
            }
        break;
    }
}

void friendly::randmove()
{
    smer = random(1, 8);
    dist = random(10, 100);
    speed = random(1, 4);
}

