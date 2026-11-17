#ifndef GAME_H
#define GAME_H
#include <iostream>
#include <SDL2/SDL.h>
#include <SDL2/SDL_ttf.h>
#include <stdio.h>
#include <vector>
#include <string>

// Enum for level result
enum class LevelStatus {
    COMPLETED,
    FAILED,
    QUIT
};

struct LevelConfig {
    std::string backgroundPath;
    std::string obstacleTexturePath;
    std::string enemyTexturePath;
    std::string friendlyTexturePath;
    
    int numObstacles;
    int numEnemies;
    int numFriendlies;
    
    int timeLimit; // in seconds
    int enemyScoreValue;
    int friendlyScoreValue;
    
    std::string introText; // Text to show in console (or screen?) at start
};

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
        void clearboard() 
        {
            remove("score.txt"); 
            if(debugMode) std::cout << "Scoreboard cleared\n";
        }

        bool hax=0;
        bool audioEnabled = true;
        bool debugMode = true; // Toggle console logging

        TTF_Font* font = NULL;
        SDL_Color textColor = { 0, 0, 0 }; 

        // Generic level runner
        LevelStatus runLevel(const LevelConfig& config);
        
        // Helper to render text on screen
        void renderText(const std::string& text, int x, int y, SDL_Color color = {255, 255, 255});
};

#endif // GAME_H
