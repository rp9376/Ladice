#ifndef OBSTICALE_H
#define OBSTICALE_H
#include <SDL2/SDL.h>
#include <time.h>
#include <cstdlib>



class obsticale
{
    public:
        obsticale();
        ~obsticale();

        void render(SDL_Renderer* rend, SDL_Texture* obsttxt);
        bool colplayer(SDL_Rect playr);

        int random(int min,int max)// w/min w/max  //maxrandom(1,0);
        {
            return rand()%(max+1-min)+min;
        }


    private:
        //int w = random(30, 80), h = w, x = random(0, 800), y = random(0, 600);
        int w, h, x, y;
        bool visible = 1;

        void spawncord();
        bool check_collision( SDL_Rect A, SDL_Rect B );

};





#endif // OBSTICALE_H
