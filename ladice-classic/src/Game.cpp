#include <iostream>
#include <cstdlib>     //system("clear");
#include <time.h>
#include <stdio.h>
#include <math.h>
#include <string>
#include <fstream>
#include <iomanip>
#include <SDL2/SDL.h>
#include <SDL2/SDL_image.h>
#include <SDL2/SDL_mixer.h>

#include "Game.h"
#include "Graphics.h"
#include "obsticale.h"
#include "enemy.h"
#include "friendly.h"

Game::Game()
{
    init();

    // Default debug mode
    debugMode = true; 

    menu();

    killme();
}
Game::~Game() {}

void Game::init()
{

    //Initialize SDL
    if( SDL_Init( SDL_INIT_EVERYTHING ) < 0 )
    {
        printf( "SDL could not initialize! SDL_Error: %s\n", SDL_GetError() );
        killme();
    }
     else
    {
        //Create window
        window = SDL_CreateWindow( "Ladice", SDL_WINDOWPOS_UNDEFINED, SDL_WINDOWPOS_UNDEFINED, SCREEN_WIDTH, SCREEN_HEIGHT, SDL_WINDOW_SHOWN );

        if( window == NULL )
        {
            printf( "Window could not be created! SDL_Error: %s\n", SDL_GetError() );
            exit(1);
        }

         //Initialize PNG loading
            int imgFlags = IMG_INIT_PNG;
            if( !( IMG_Init( imgFlags ) & imgFlags ) )
            {
                printf( "SDL_image could not initialize! SDL_image Error: %s\n", IMG_GetError() );
            }


        if( Mix_OpenAudio( 22050, MIX_DEFAULT_FORMAT, 2, 4096 ) == -1 )
        {
            printf( "SDl_Mixer init failed SDL_Error: %s\n", SDL_GetError() );
            audioEnabled = false;
        }

        //Initialize SDL_ttf
        if( TTF_Init() == -1 )
        {
            printf( "SDL_ttf could not initialize! SDL_ttf Error: %s\n", TTF_GetError() );
        }
        else
        {
             //Load font
            font = TTF_OpenFont( "assets/font.ttf", 28 );
            if( font == NULL )
            {
                printf( "Failed to load lazy font! SDL_ttf Error: %s\n", TTF_GetError() );
            }
        }


        /*
        else
        {
            //Get window surface
            screenSurface = SDL_GetWindowSurface( window );

            //Fill the surface white
            SDL_FillRect( screenSurface, NULL, SDL_MapRGB( screenSurface->format, 0x00, 0x00, 0x00 ) );

            //Update the surface
            SDL_UpdateWindowSurface( window );
        }
        */

        //renderer init
        renderer = SDL_CreateRenderer(window, -1, SDL_RENDERER_ACCELERATED);
        if (renderer == NULL)
        {
             std::cout << "Hardware Init Failed: " << SDL_GetError() << std::endl;
             std::cout << "Falling back to software renderer..." << std::endl;
             renderer = SDL_CreateRenderer(window, -1, SDL_RENDERER_SOFTWARE);
        }

        if (renderer == NULL)
            {
                std::cout<<"Renderer creation error: " << SDL_GetError() << std::endl;
                killme();
            }
        SDL_SetRenderDrawColor(renderer, 0xff, 0xff, 0xff, 0xff);
    }
}

void Game::killme()
{
    //Destroy window
    if (font != NULL)
    {
        TTF_CloseFont(font);
        font = NULL;
    }
    SDL_DestroyWindow( window );
    SDL_DestroyRenderer(renderer);

    //Quit SDL subsystems
    TTF_Quit();
    IMG_Quit();
    SDL_Quit();
    exit(0);
}

int Game::menu()
{
    //SDL_Surface *menuSurface = NULL;
    //SDL_Surface *imageSurface = NULL;
    //SDL_Surface *black = NULL;
    Mix_Music *music = NULL;
    Mix_Music *musicHax = NULL;


    // Use Renderer for Menu
    SDL_Texture* menuTexture = IMG_LoadTexture(renderer, "assets/Boat_wBtn.png");
    if(menuTexture == NULL)
    {
        std::cout<< "SDL could not load Boat image! " << SDL_GetError()<<std::endl;
    }

    music = Mix_LoadMUS( "assets/MenuSound.wav" );
    musicHax = Mix_LoadMUS( "assets/MenuSoundHax.wav" );

    if (audioEnabled) {
        if(!hax)
            Mix_PlayMusic(music, 420);
        else
            Mix_PlayMusic(musicHax, 420);
    }

    int cordx, cordy;
    bool pressed=0;
    bool click = 0;

    while ( true )
    {
        event(0);
        
        // Render menu
        SDL_RenderClear(renderer);
        if(menuTexture)
            SDL_RenderCopy(renderer, menuTexture, NULL, NULL);
        SDL_RenderPresent(renderer);
        SDL_Delay(10); // Reduce CPU usage

        cordx = evnt.motion.x - 693;
        cordy = evnt.motion.y - 165;
        //std::cout<<"x: "<<cordx<<"  y: "<<cordy<<std::endl;
        //std::cout <<sqrt(cordx*cordx + cordy*cordy)<<std::endl;
        if(pressed==0 && evnt.type == SDL_MOUSEBUTTONDOWN && evnt.button.button == 2 && sqrt(cordx*cordx + cordy*cordy)<74)
            {
                if(hax==0)
                {
                    if (audioEnabled) Mix_PlayMusic(musicHax, 420);
                    if(debugMode) std::cout <<"Hack Mode: ON"<<std::endl;
                    hax=1;
                    pressed=1;
                }
                else
                {
                    if (audioEnabled) Mix_PlayMusic(music, 420);
                    if(debugMode) std::cout <<"Hack Mode: OFF"<<std::endl;
                    hax=0;
                    pressed=1;
                }
            }
            else
                if(pressed==1 && evnt.type == SDL_MOUSEBUTTONUP && evnt.button.button == 2)
                {
                    //std::cout <<"button up"<<std::endl;
                    pressed=0;
                    SDL_PollEvent(&evnt);
                }

        //X button
        if(click == 0 && evnt.motion.x > 745 && evnt.motion.x < 790 && evnt.motion.y > 5 && evnt.motion.y < 53 && evnt.type == SDL_MOUSEBUTTONDOWN )
        {
            killme();
        }
        else
        if(evnt.type == SDL_MOUSEBUTTONUP)
            click = 0;

        //trophy button
        if(click == 0 && evnt.motion.x > 678 && evnt.motion.x < 732 && evnt.motion.y > 5 && evnt.motion.y < 53 && evnt.type == SDL_MOUSEBUTTONDOWN)
        {
            scoreboardizp();
            click = 1;
        }
        else
        if(evnt.type == SDL_MOUSEBUTTONUP)
            click = 0;

        //clear board button
        if(click == 0 && evnt.motion.x > 175 && evnt.motion.x < 200 && evnt.motion.y > 35 && evnt.motion.y < 55 && evnt.type == SDL_MOUSEBUTTONDOWN)
        {
            clearboard();
            click = 1;
        }
        else
        if(evnt.type == SDL_MOUSEBUTTONUP)
            click = 0;

        //PLAY NOW button
        if(evnt.motion.x > 470 && evnt.motion.x < 765 && evnt.motion.y > 325 && evnt.motion.y < 412 && evnt.type == SDL_MOUSEBUTTONDOWN )
            {
               //break;
                Lv1();
            }


    }

    if(menuTexture)
        SDL_DestroyTexture(menuTexture);
    
}

void Game::event(bool showval)
{
    while(SDL_PollEvent(&evnt))
    {
        if (evnt.type == SDL_QUIT) 
        {
            killme();
        }

        if (showval && debugMode)
        {
            switch (evnt.type)
            {
            case SDL_MOUSEMOTION:
                std::cout << "X: " <<evnt.motion.x << "  " << "Y: " << evnt.motion.y <<std::endl;
                break;

            case SDL_MOUSEBUTTONDOWN:
                switch (evnt.button.button)
                {
                case 1:
                    std::cout << "Left button pressed" << std::endl;
                    break;
                case 2:
                    std::cout << "Middle button pressed" << std::endl;
                    break;
                case 3:
                    std::cout << "Right button pressed" << std::endl;
                    break;
                }
                break;

            case SDL_MOUSEBUTTONUP:
                switch (evnt.button.button)
                {
                case 1:
                    std::cout << "Left button released" << std::endl;
                    break;
                case 2:
                    std::cout << "Middle button released" << std::endl;
                    break;
                case 3:
                    std::cout << "Right button released" << std::endl;
                    break;
                }
                break;
            }
        }
    }
}

// Helper to render text
void Game::renderText(const std::string& text, int x, int y, SDL_Color color)
{
    if (!font || text.empty()) return;
    SDL_Surface* surface = TTF_RenderText_Solid(font, text.c_str(), color);
    if (!surface) return;
    SDL_Texture* texture = SDL_CreateTextureFromSurface(renderer, surface);
    if (texture)
    {
        SDL_Rect rect = {x, y, surface->w, surface->h};
        SDL_RenderCopy(renderer, texture, NULL, &rect);
        SDL_DestroyTexture(texture);
    }
    SDL_FreeSurface(surface);
}

LevelStatus Game::runLevel(const LevelConfig& config)
{
    system("clear");
    if (!config.introText.empty())
    {
        std::cout << config.introText << std::endl;
    }

    Graphics graphics;
    SDL_Texture* Background = graphics.loadTexture(config.backgroundPath.c_str(), renderer);
    SDL_Texture* obst = graphics.loadTexture(config.obstacleTexturePath.c_str(), renderer);
    SDL_Texture* enemytx = graphics.loadTexture(config.enemyTexturePath.c_str(), renderer);
    SDL_Texture* frietx = graphics.loadTexture(config.friendlyTexturePath.c_str(), renderer);
    SDL_Texture* Player = graphics.loadTexture("assets/playerboat.png", renderer);
    
    SDL_Rect playerrect; playerrect.w = 50; playerrect.h = 50; playerrect.x = 700; playerrect.y = 50;

    std::vector<obsticale> obstacles(config.numObstacles);
    std::vector<enemy> enemies(config.numEnemies);
    std::vector<friendly> friendlies(config.numFriendlies);

    int gametime = config.timeLimit * 1000;
    int gametimer = 0;
    int lasttime = 0;
    bool tracking = false;
    
    LevelStatus status = LevelStatus::QUIT; // Default if loop logic fails
    bool running = true;
    
     // If font not loaded, try loading
    if(!font) font = TTF_OpenFont( "assets/font.ttf", 24 );

    while(running)
    {
        event(0);
        
        // Mouse logic
        int mx, my;
        Uint32 buttons = SDL_GetMouseState(&mx, &my);
        
        if(tracking)
        {
            playerrect.x = mx - 25;
            playerrect.y = my - 25;

            if(buttons & SDL_BUTTON(SDL_BUTTON_RIGHT))
                tracking = false;
            
            if(buttons & SDL_BUTTON(SDL_BUTTON_MIDDLE))
            {
                menu(); // Recursive call, but preserving original behavior
                std::cout << "Level break" << std::endl;
                status = LevelStatus::QUIT;
                running = false;
            }
        }
        else
        {
            // Check start click
            if (mx > playerrect.x && mx < playerrect.x + 50 && my > playerrect.y && my < playerrect.y + 50 && (buttons & SDL_BUTTON(SDL_BUTTON_LEFT)))
            {
                tracking = true;
            }
        }
        
        // Timer
        if(tracking) {
            if(lasttime == 0) lasttime = SDL_GetTicks();
            else {
                int curtime = SDL_GetTicks();
                gametimer += (curtime - lasttime);
                lasttime = curtime;
            }
            // Console output (legacy)
            if(debugMode) {
                system("clear");
                std::cout<< "Seconds remaining: " << (float)(gametime - gametimer) / 1000 <<"\n";
            }
        } else {
             lasttime = 0;
        }
        
        if (gametimer >= gametime) {
             status = LevelStatus::COMPLETED;
             running = false;
        }
        
        // Collisions
        if (tracking && running) {
             if (!hax) {
                  for (auto& o : obstacles) {
                      if (o.colplayer(playerrect)) {
                          if(debugMode) std::cout << "Game Over: You hit an iceberg!" << std::endl;
                          status = LevelStatus::FAILED;
                          running = false;
                          break;
                      }
                  }
             }
             if(!running) break;
             
             for (auto& e : enemies) {
                 if (e.colplayer(playerrect)) {
                     score += config.enemyScoreValue;
                     e.respawncord();
                 }
             }
             
             if (!hax) {
                 for (auto& f : friendlies) {
                     if (f.colplayer(playerrect)) {
                         score += config.friendlyScoreValue;
                         animalskilled++;
                         f.respawncord();
                     }
                 }
             } else {
                 for (auto& f : friendlies) f.movement();
             }
        }
        
        // Render
        SDL_RenderClear(renderer);
        if(Background) SDL_RenderCopy(renderer, Background, NULL, NULL);
        
        for(auto& o : obstacles) o.render(renderer, obst);
        for(auto& e : enemies) e.render(renderer, enemytx, hax);
        for(auto& f : friendlies) f.render(renderer, frietx, hax);
        
        SDL_RenderCopy(renderer, Player, NULL, &playerrect);
        
        // Render UI
        std::string timeStr = "Time: " + std::to_string(std::max(0, (gametime - gametimer)/1000));
        renderText(timeStr, 650, 10);
        std::string scoreStr = "Score: " + std::to_string(score);
        renderText(scoreStr, 10, 10);

        SDL_RenderPresent(renderer);
        SDL_Delay(16);
    }
    
    SDL_DestroyTexture(Background);
    SDL_DestroyTexture(obst);
    SDL_DestroyTexture(enemytx);
    SDL_DestroyTexture(frietx);
    SDL_DestroyTexture(Player);
    
    return status;
}

void Game::Lv1()
{
    breaklv = 0;
    score = 0;    // Reset score for new game
    animalskilled = 0;
    
    LevelConfig config;
    config.introText = "      INSTRUCTIONS\nThe goal of the game is to defeat as many pirates as possible within the given time.\nRunning over animals deducts points.\nHitting an obstacle ends the level immediately.\nClick on the ship to start the game.\nRight-click to pause.\nMiddle-click to return to the menu.\n\n";
    config.backgroundPath = "assets/Blue.png";
    config.obstacleTexturePath = "assets/Iceberg.png";
    config.enemyTexturePath = "assets/enemyboat.png";
    config.friendlyTexturePath = "assets/pingo.png";
    config.numObstacles = 6;
    config.numEnemies = 3;
    config.numFriendlies = 1;
    config.timeLimit = lvtime;
    config.friendlyScoreValue = -50;
    config.enemyScoreValue = 100;
    
    LevelStatus status = runLevel(config);
    
    if (status != LevelStatus::QUIT) {
         if(debugMode) {
            std::cout << "Your score: " << score << std::endl << "You killed: " << animalskilled << " Animals" << std::endl;
            if(animalskilled >= 3) std::cout << "You monster!" << std::endl;
         }
         SDL_Delay(1000);
         Lv2();
    }
}

void Game::Lv2()
{
    LevelConfig config;
    config.introText = ""; // No intro text for Lv2
    config.backgroundPath = "assets/Green.png";
    config.obstacleTexturePath = "assets/Lilipad.png";
    config.enemyTexturePath = "assets/enemyboat.png";
    config.friendlyTexturePath = "assets/zabika.png";
    config.numObstacles = 7;
    config.numEnemies = 2;
    config.numFriendlies = 3;
    config.timeLimit = lvtime;
    config.friendlyScoreValue = -50;
    config.enemyScoreValue = 200;
    
    LevelStatus status = runLevel(config);
    
    if (status != LevelStatus::QUIT) {
         if(debugMode) {
            std::cout << "Your score: " << score << std::endl << "You killed: " << animalskilled << " Animals" << std::endl;
            if(animalskilled >= 3) std::cout << "You monster!" << std::endl;
         }
         SDL_Delay(1000);
         Lv3();
    }
}

void Game::Lv3()
{
    LevelConfig config;
    config.introText = ""; 
    config.backgroundPath = "assets/Orange.png";
    config.obstacleTexturePath = "assets/crystal.png";
    config.enemyTexturePath = "assets/enemyboat.png";
    config.friendlyTexturePath = "assets/ribica.png";
    config.numObstacles = 9;
    config.numEnemies = 1;
    config.numFriendlies = 5;
    config.timeLimit = lvtime;
    config.friendlyScoreValue = -50;
    config.enemyScoreValue = 300;
    
    LevelStatus status = runLevel(config);
    
    if (status != LevelStatus::QUIT) {
         if(debugMode) {
            std::cout << "Your score: " << score << std::endl << "You killed: " << animalskilled << " Animals" << std::endl;
            if(animalskilled >= 3) std::cout << "You monster!" << std::endl;
         }
         
         // Special ending
         Graphics graphics;
         SDL_Texture* doggo = graphics.loadTexture("assets/seadoggo.png", renderer);
         if(doggo) {
             SDL_RenderClear(renderer);
             SDL_RenderCopy(renderer, doggo, NULL, NULL); 
             SDL_RenderPresent(renderer);
             SDL_Delay(1000);
             SDL_DestroyTexture(doggo);
         }
         
         scoreboard();
         menu();
    }
}

void Game::scoreboard()
{
    /*
    }
    */
    std::ifstream data("score.txt");
    std::ofstream data1("tmp.txt");
    if(data.is_open() && data1.is_open())
    {
        system("clear");
        std::string ime, str;
        int val;
        bool done = 0;
        std::cout << "Enter your name: ";
        std::getline(std::cin, ime);
        while(data >> str >> val)
        {
            if(done == 0 && score > val)
            {
                data1 << ime << " " << score << std::endl;
                data1 << str << " " << val << std::endl;
                done = 1;
            }
            else
            {
                data1 << str << " " << val << std::endl;
            }
        }
        if(done == 0)
        {
            data1 << ime << " " << score << std::endl;
        }

        data.close();
        data1.close();
        remove("score.txt");
        rename("tmp.txt", "score.txt");
    }
    else
    {
        std::ofstream data3("score.txt", std::ios::app);
        if(data3.is_open())
        {
            std::string str;
            system("clear");
            std::cout << "Enter your name: ";
            std::getline(std::cin, str);
            data3 << str << " " << score << std::endl;
            data3.close();
        }
    }
}

void Game::scoreboardizp()
{
    // Load Background
    SDL_Texture* background = IMG_LoadTexture(renderer, "assets/Boat_no_moon.png");
    if(background == NULL)
    {
        std::cout << "Failed to load scoreboard background: " << SDL_GetError() << std::endl;
    }

    SDL_RenderClear(renderer);
    
    // Draw Background
    if(background)
    {
         SDL_RenderCopy(renderer, background, NULL, NULL);
    }
    else
    {
         // Fallback to black if image fails
         SDL_SetRenderDrawColor(renderer, 0x00, 0x00, 0x00, 0xFF);
         SDL_RenderClear(renderer);
    }

    if(!font) {
        std::cout << "Font not loaded!" << std::endl;
        // Fallback or attempt reload
        font = TTF_OpenFont( "assets/font.ttf", 28 );
    }

    // Title
    SDL_Color white = {255, 255, 255};
    SDL_Surface* textSurface = TTF_RenderText_Solid(font, "SCOREBOARD", white);
    if(textSurface) {
        SDL_Texture* textTexture = SDL_CreateTextureFromSurface(renderer, textSurface);
        SDL_Rect textRect = {SCREEN_WIDTH/2 - textSurface->w/2, 50, textSurface->w, textSurface->h};
        SDL_RenderCopy(renderer, textTexture, NULL, &textRect);
        SDL_FreeSurface(textSurface);
        SDL_DestroyTexture(textTexture);
    }

    // Read scores
    std::ifstream data("score.txt");
    std::string str;
    int val;
    int yPos = 120;
    int counter = 1;

    if(data.is_open())
    {
        while(data >> str >> val && counter <= 10)
        {
            std::string line = std::to_string(counter) + ". " + str + "  " + std::to_string(val);
            textSurface = TTF_RenderText_Solid(font, line.c_str(), white);
            if(textSurface) {
                SDL_Texture* textTexture = SDL_CreateTextureFromSurface(renderer, textSurface);
                SDL_Rect textRect = {SCREEN_WIDTH/2 - textSurface->w/2, yPos, textSurface->w, textSurface->h};
                SDL_RenderCopy(renderer, textTexture, NULL, &textRect);
                SDL_FreeSurface(textSurface);
                SDL_DestroyTexture(textTexture);
                yPos += 40;
            }
            counter++;
        }
        data.close();
    }
    else {
        textSurface = TTF_RenderText_Solid(font, "No scores yet!", white);
        if(textSurface) {
            SDL_Texture* textTexture = SDL_CreateTextureFromSurface(renderer, textSurface);
            SDL_Rect textRect = {SCREEN_WIDTH/2 - textSurface->w/2, yPos, textSurface->w, textSurface->h};
            SDL_RenderCopy(renderer, textTexture, NULL, &textRect);
            SDL_FreeSurface(textSurface);
            SDL_DestroyTexture(textTexture);
        }
    }

    // Back Button
    SDL_Rect backButton = {SCREEN_WIDTH/2 - 100, 520, 200, 50};
    SDL_SetRenderDrawColor(renderer, 255, 0, 0, 255); // Red button
    SDL_RenderFillRect(renderer, &backButton);
    
    // Button Text
    textSurface = TTF_RenderText_Solid(font, "Back to Menu", white);
    if(textSurface) {
        SDL_Texture* textTexture = SDL_CreateTextureFromSurface(renderer, textSurface);
        SDL_Rect textRect = {
            backButton.x + (backButton.w - textSurface->w)/2,
            backButton.y + (backButton.h - textSurface->h)/2,
            textSurface->w,
            textSurface->h
        };
        SDL_RenderCopy(renderer, textTexture, NULL, &textRect);
        SDL_FreeSurface(textSurface);
        SDL_DestroyTexture(textTexture);
    }

    SDL_RenderPresent(renderer);


    // Wait for input
    bool waiting = true;
    while(waiting) {
        while(SDL_PollEvent(&evnt)) {
            if(evnt.type == SDL_QUIT) {
                killme();
            }
            if(evnt.type == SDL_MOUSEBUTTONDOWN) {
                int mx = evnt.motion.x;
                int my = evnt.motion.y;
                if(mx >= backButton.x && mx <= backButton.x + backButton.w &&
                   my >= backButton.y && my <= backButton.y + backButton.h) {
                    waiting = false; // Go back
                }
            }
        }
        SDL_Delay(10);
    }

    if(background)
    {
        SDL_DestroyTexture(background);
    }
}

