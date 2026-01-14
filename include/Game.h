#ifndef GAME_H
#define GAME_H
#include <iostream>
#include <SDL2/SDL.h>
#include <stdio.h>

class Game
{
    public:
        Game();
       ~Game();
        void init();
        void killme();
        int menu();
        void event(bool showval);
        void Lv1();
        void Lv2();
        void Lv3();

        bool breaklv = 0;
        SDL_Renderer* renderer;

    private:

        int SCREEN_WIDTH = 800;
        int SCREEN_HEIGHT = 600;
        //The window we'll be rendering to
        SDL_Window* window = NULL;
        //The surface contained by the window
        SDL_Surface* screenSurface = NULL;
        //Event handler
        SDL_Event evnt;

        int lvtime = 30;
        int score = 0;
        int animalskilled = 0;

        void scoreboard();
        void scoreboardizp();
        void clearboard() {remove("score.txt"); std::cout << "Scoreboard cleared\n";}

        bool hax=0;
        bool audioEnabled = true;

};

#endif // GAME_H
