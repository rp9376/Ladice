#ifndef FRIENDLY_H
#define FRIENDLY_H
#include <SDL2/SDL.h>
#include <time.h>
#include <cstdlib>

class friendly
{
    public:
        friendly();
        ~friendly();
        void render(SDL_Renderer* rend, SDL_Texture* frietxt, bool hax);
        bool colplayer(SDL_Rect playr);
        void respawncord();
        void movement();
        void randmove();

    private:
        int w = 50, h = w, x, y;
        int smer, dist, speed;
        int visibility = 200;

        bool visible = 1;
        bool respawn = 1;

        bool ifvisible(SDL_Rect playr, SDL_Rect frierect, int range);
        bool check_collision( SDL_Rect A, SDL_Rect B );


        int random(int min,int max)// w/min w/max  //maxrandom(1,0);
        {
            return rand()%(max+1-min)+min;
        }
};

#endif // FRIENDLY_H
